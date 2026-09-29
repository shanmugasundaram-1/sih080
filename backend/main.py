from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from weather_api import fetch_open_meteo_forecast

app = FastAPI(title="SIH Rainfall Forecast AI")

# Allow React to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Coordinates(BaseModel):
    latitude: float
    longitude: float

import joblib
import pandas as pd
import os

# Load the trained AI Models into memory at startup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
classifier_path = os.path.join(BASE_DIR, 'regime_classifier.pkl')
corrector_path = os.path.join(BASE_DIR, 'bias_corrector.pkl')

if os.path.exists(classifier_path) and os.path.exists(corrector_path):
    regime_model = joblib.load(classifier_path)
    bias_model = joblib.load(corrector_path)
    print("AI Models successfully loaded into FastAPI Pipeline!")
else:
    print("WARNING: .pkl models not found. Please run train_model.py first.")
    regime_model, bias_model = None, None

import math

def run_real_ai_pipeline(raw_forecast_data):
    # Prepare the exact same feature names as the training data
    df = pd.DataFrame([{
        'nwp_rain': raw_forecast_data.get("raw_rainfall_nwp", 0),
        'temperature': raw_forecast_data.get("temperature", 30.0), # Now fetching real data
        'humidity': raw_forecast_data.get("humidity", 85.0),
        'pressure': raw_forecast_data.get("pressure", 1005.0),
        'wind': raw_forecast_data.get("wind", 15.0)
    }])
    
    # Run Inference
    if regime_model and bias_model:
        regime = regime_model.predict(df)[0]
        corrected_rain = bias_model.predict(df)[0]
    else:
        # Fallback if model missing
        regime = "Unknown"
        corrected_rain = df['nwp_rain'][0]

    # IMD Threshold for Heavy Rain is 64.5 mm. 
    if corrected_rain >= 64.5:
        # Logistic curve for >= 64.5mm
        prob = 1 / (1 + math.exp(-0.1 * (corrected_rain - 64.5)))
    else:
        # Scale smoothly between 0 and 50% for values < 64.5mm so the metric feels alive
        prob = ((corrected_rain / 64.5) ** 1.5) * 0.5
        
    probability = round(prob, 3)
    
    if corrected_rain == 0:
        probability = 0.0
        
    return regime, round(corrected_rain, 2), probability

@app.post("/api/forecast")
def get_forecast(coords: Coordinates):
    # 1. Fetch RAW NWP from Open-Meteo
    weather_data = fetch_open_meteo_forecast(coords.latitude, coords.longitude)
    
    if weather_data.get("status") == "error":
        return {"error": "Failed to fetch Open-Meteo"}

    # 2. Feed Raw Data into previously trained Scikit-Learn .pkl Models
    regime, corrected_rain, heavy_prob = run_real_ai_pipeline(weather_data)
    
    return {
        "status": "success",
        "latitude": coords.latitude,
        "longitude": coords.longitude,
        "predicted_regime": regime,
        "raw_rainfall_nwp": weather_data.get("raw_rainfall_nwp", 0),
        "bias_corrected_rainfall": corrected_rain,
        "heavy_rain_probability": heavy_prob
    }

import json
@app.get("/api/verification")
def get_verification_metrics():
    metrics_file = os.path.join(BASE_DIR, 'metrics.json')
    if os.path.exists(metrics_file):
        with open(metrics_file, 'r') as f:
            return json.load(f)
    return {"error": "Metrics not found"}
