from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv   # 🔴 new

load_dotenv()  

app = Flask(__name__)
CORS(app)  # allow frontend from Netlify or any domain

# --- Configure Gemini ---
# Load API key from environment
gemini_api_key = os.getenv("GEMINI_API_KEY")   # 🔴

if not gemini_api_key:                         # 🔴
    # This will show clearly in logs if the key is missing
    raise ValueError("GEMINI_API_KEY is not set in environment")  # 🔴

genai.configure(api_key=gemini_api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/get", methods=["POST"])
def get_bot_response():
    data = request.get_json()
    user_input = data.get("message", "")

    if not user_input:
        return jsonify({"response": "Please say something."})

    try:
        response = model.generate_content(user_input)
        return jsonify({"response": response.text})
    except Exception as e:
        # Log error to Render logs
        print("Gemini error:", e)              # 🔴
        return jsonify({"response": "Internal server error."}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
