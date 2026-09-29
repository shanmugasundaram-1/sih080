import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
import joblib
import os

print("Fetching historical dataset...")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
excel_path = os.path.join(BASE_DIR, 'data', 'india_weather_rainfall_data.xlsx')

# 1. LOAD EXCEL DATA
# We load the entire dataset. It is huge, so we might sample it if needed to save time, but let's try reading all.
print(f"Reading Data from: {excel_path}")
df = pd.read_excel(excel_path)
df = df.dropna(subset=['rainfall', 'avg_temp', 'wind_speed', 'air_pressure']).copy()

# Sample 10000 rows for faster hackathon training (remove this in production)
if len(df) > 10000:
    df = df.sample(10000, random_state=42)

# 2. FEATURE ENGINEERING (Simulating NWP predictions)
# We assume the generic 'rainfall' is the Ground Truth Actual Rain
# We create 'nwp_rain' by adding generic NWP biases (like underestimating heavy rain)
np.random.seed(42)
df['actual_rain'] = df['rainfall']
noise = np.random.normal(0, 3, len(df))
# NWP tends to underpredict heavy rain and overpredict light drizzle
df['nwp_rain'] = np.where(df['actual_rain'] > 50, df['actual_rain'] * 0.7, df['actual_rain'] + noise)
df['nwp_rain'] = np.where(df['nwp_rain'] < 0, 0, df['nwp_rain']) # No negative rain

# Map column names for our pipeline
df = df.rename(columns={
    'avg_temp': 'temperature',
    'wind_speed': 'wind',
    'air_pressure': 'pressure'
})

# We need humidity for our pipeline. Since it's missing in the sheet, let's derive a proxy from season/temp
df['humidity'] = np.where(df['season'] == 'Monsoon', np.random.uniform(70, 100, len(df)), np.random.uniform(30, 60, len(df)))

X = df[['nwp_rain', 'temperature', 'humidity', 'pressure', 'wind']]

# 3. TARGET VARIABLES
# A) Regime Classification
def assign_regime(row):
    if row['pressure'] < 1000 and row['wind'] > 15: return "Depression"
    if row['actual_rain'] > 50: return "Active Monsoon"
    if row['temperature'] > 30 and row['humidity'] < 60: return "Break Monsoon"
    return "Coastal/Orographic"

y_regime = df.apply(assign_regime, axis=1)

# B) Bias Correction Ground Truth
y_actual_rain = df['actual_rain']

# 4. TRAINING THE A.I. MODELS
print("Training AI Weather Regime Classifier (Random Forest)...")
clf = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
clf.fit(X, y_regime)

print("Training AI Bias Correction Regressor (Random Forest)...")
reg = RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42)
reg.fit(X, y_actual_rain)

# 5. EXPORTING THE INTELLIGENCE
joblib.dump(clf, os.path.join(BASE_DIR, 'regime_classifier.pkl'))
joblib.dump(reg, os.path.join(BASE_DIR, 'bias_corrector.pkl'))

print("Success! AI Models trained natively on 'india_weather_rainfall_data.xlsx' and saved.")

