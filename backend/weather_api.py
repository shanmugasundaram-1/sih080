import requests
import json

def fetch_open_meteo_forecast(latitude: float, longitude: float):
    # Using Open-Meteo GFS model for India
    url = f"https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ["temperature_2m", "relative_humidity_2m", "rain", "surface_pressure", "wind_speed_10m"],
        "models": "gfs_seamless",
        "timezone": "Asia/Kolkata"
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # We extract just the next 24 hours of rain to get a daily sum
        rain_array = data["hourly"]["rain"][:24]
        total_rain_nwp = sum(rain_array)
        
        # We can also get average temp, humidity, etc for the next 24 hrs for the AI model
        temp_array = data["hourly"]["temperature_2m"][:24]
        humidity_array = data["hourly"]["relative_humidity_2m"][:24]
        pressure_array = data["hourly"]["surface_pressure"][:24]
        wind_array = data["hourly"]["wind_speed_10m"][:24]
        
        return {
            "status": "success",
            "raw_rainfall_nwp": round(total_rain_nwp, 2),
            "temperature": round(sum(temp_array)/24, 2),
            "humidity": round(sum(humidity_array)/24, 2),
            "pressure": round(sum(pressure_array)/24, 2),
            "wind": round(sum(wind_array)/24, 2)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Test for Chennai
    print(fetch_open_meteo_forecast(13.0827, 80.2707))
