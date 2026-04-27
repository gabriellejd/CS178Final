from flask import Flask, render_template
import duckdb
import folium
import os

app = Flask(__name__)

# Route for the main dashboard
@app.route('/')
def index():
    # 1. Connect to your database
    # Make sure mbta_data.db is in the same folder!
    con = duckdb.connect('mbta_data.db')
    
    # 2. Run your map query (the one that shows the Medford 'blooms')
    map_query = """
    SELECT 
        stop_name, AVG(stop_lat) as lat, AVG(stop_lon) as lon,
        AVG(headway_branch_seconds) as avg_wait,
        STDDEV(headway_branch_seconds) as std_dev
    FROM mbta_master_geo
    GROUP BY stop_name
    """
    df = con.execute(map_query).df().fillna(0)
    
    # 3. Create the Folium Map
    m = folium.Map(location=[42.3601, -71.0589], zoom_start=12, tiles='CartoDB dark_matter')
    
    for _, row in df.iterrows():
        radius = (row['std_dev'] / 1000) + 2
        color = '#ff4b4b' if row['avg_wait'] > 600 else '#00ff7f'
        
        folium.CircleMarker(
            location=[row['lat'], row['lon']],
            radius=radius,
            color=color,
            fill=True,
            popup=f"{row['stop_name']}: {int(row['avg_wait']/60)}m wait"
        ).add_to(m)
    
    # 4. Turn the map into HTML code to send to the browser
    map_html = m._repr_html_()
    
    return render_template('index.html', map_html=map_html)

if __name__ == '__main__':
    app.run(debug=True)