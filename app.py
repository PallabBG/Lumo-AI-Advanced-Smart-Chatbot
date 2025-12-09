import smtplib
import random
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv   # 🔴 new

load_dotenv()  

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")
sender = os.getenv("EMAIL_USER")
password = os.getenv("EMAIL_PASS")

# MongoDB connection (local)
mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri)
db = client.get_database("lumo_db")
users_col = db.users
chats_col = db.chats
otp_col = db.otps

CORS(app)  # allow frontend from Netlify or any domain

# --- Configure Gemini ---
# Load API key from environment
gemini_api_key = os.getenv("GEMINI_API_KEY")   # 🔴

if not gemini_api_key:                         # 🔴
    # This will show clearly in logs if the key is missing
    raise ValueError("GEMINI_API_KEY is not set in environment")  # 🔴

genai.configure(api_key=gemini_api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

def is_logged_in():
  return "user_id" in session


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form["username"].strip()
        email = request.form["email"].strip().lower()
        password = request.form["password"]

        # Check existing email
        if users_col.find_one({"email": email}):
            return "Email already registered. Try logging in."

        # Hash password
        hashed_pw = generate_password_hash(password)

        # Insert user
        result = users_col.insert_one({
            "username": username,
            "email": email,
            "password": hashed_pw
        })
        print("Inserted user with _id:", result.inserted_id)
        # After signup, go to login
        return redirect(url_for("login"))

    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        password = request.form["password"]

        user = users_col.find_one({"email": email})
        if not user or not check_password_hash(user["password"], password):
            return "Invalid email or password."

        # Save user info in session
        session["user_id"] = str(user["_id"])
        session["username"] = user["username"]
        return redirect(url_for("home"))

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def home():
    if not is_logged_in():
        return redirect(url_for("login"))
    return render_template("index.html")

@app.route("/get", methods=["POST"])
def get_bot_response():
    if not is_logged_in():
        return jsonify({"response": "Please log in first."})

    data = request.get_json() or {}
    user_input = (data.get("message") or "").strip()
    history = data.get("history", [])

    if not user_input:
        return jsonify({"response": "Please say something."})

    try:
        contents = []

        # Previous conversation
        for turn in history:
            role = turn.get("role", "user")
            text = (turn.get("text") or "").strip()
            if not text:
                continue
            contents.append({
                "role": role,
                "parts": [{"text": text}]
            })

        # Current message
        contents.append({
            "role": "user",
            "parts": [{"text": user_input}]
        })

        response = model.generate_content(contents)
        reply_text = response.text

        # Save chat in DB
        chats_col.insert_one({
            "user_id": session["user_id"],
            "username": session.get("username"),
            "user_message": user_input,
            "bot_reply": reply_text
            # you can also add "timestamp": datetime.now()
        })

        return jsonify({"response": reply_text})
    except Exception as e:
        print("Gemini error:", e)
        return jsonify({"response": "Internal server error."}), 500
    
    
@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        user = users_col.find_one({"email": email})
        if not user:
            return "No account found with that email."

        otp = str(random.randint(100000, 999999))
        expiry = datetime.now() + timedelta(minutes=5)

        otp_col.delete_many({"email": email})  # clear old OTPs
        otp_col.insert_one({"email": email, "otp": otp, "expiry": expiry})

        # Send OTP via email
        sender = os.getenv("EMAIL_USER")
        password = os.getenv("EMAIL_PASS")

        msg = MIMEText(f"Your OTP for resetting your password is: {otp}\nThis OTP will expire in 5 minutes.")
        msg["Subject"] = "Lumo AI - Password Reset OTP"
        msg["From"] = sender
        msg["To"] = email

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(sender, password)
                server.send_message(msg)
        except Exception as e:
            print("Email send error:", e)
            return "Error sending OTP. Check your email credentials."

        session["reset_email"] = email
        return redirect(url_for("verify_otp"))

    return render_template("forgot_password.html")


@app.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():
    email = session.get("reset_email")
    if not email:
        return redirect(url_for("forgot_password"))

    if request.method == "POST":
        otp_input = request.form["otp"].strip()
        record = otp_col.find_one({"email": email, "otp": otp_input})

        if not record:
            return "Invalid OTP."

        if datetime.now() > record["expiry"]:
            return "OTP expired. Please try again."

        # OTP correct — go to new password page
        session["otp_verified"] = True
        return redirect(url_for("reset_password_new"))

    return render_template("verify_otp.html")


@app.route("/reset-password-new", methods=["GET", "POST"])
def reset_password_new():
    if not session.get("otp_verified"):
        return redirect(url_for("forgot_password"))

    email = session.get("reset_email")

    if request.method == "POST":
        new_pw = request.form["new_password"]
        confirm_pw = request.form["confirm_password"]

        if new_pw != confirm_pw:
            return "Passwords do not match."

        hashed_pw = generate_password_hash(new_pw)
        users_col.update_one({"email": email}, {"$set": {"password": hashed_pw}})

        # cleanup session + otp
        otp_col.delete_many({"email": email})
        session.pop("otp_verified", None)
        session.pop("reset_email", None)

        return "Password reset successful! You can now log in."

    return render_template("reset_password_new.html")



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))