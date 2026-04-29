from flask import Flask, render_template, request
import duckdb
import folium
import os

app = Flask(__name__)

# Route for the main dashboard
@app.route('/')
def index():
    con = duckdb.connect('mbta_data.db')

    line = request.args.get('line')
    min_wait = request.args.get('min_wait')

    day = request.args.get('day')
    time_of_day = request.args.get('time_of_day')
    month = request.args.get('month')

    where_clauses = []

    if day:
        where_clauses.append(f"dayname(service_date) = '{day}'")

    if month:
        where_clauses.append(f"month(service_date) = {int(month)}")

    if time_of_day:
        if time_of_day == "morning":
            where_clauses.append("stop_departure_sec >= 21600 AND stop_departure_sec < 36000")
        elif time_of_day == "midday":
            where_clauses.append("stop_departure_sec >= 36000 AND stop_departure_sec < 54000")
        elif time_of_day == "evening":
            where_clauses.append("stop_departure_sec >= 54000 AND stop_departure_sec < 68400")
        elif time_of_day == "night":
            where_clauses.append("(stop_departure_sec >= 68400 OR stop_departure_sec < 21600)")

    if line:
        if line == "Green":
            where_clauses.append("route_id LIKE 'Green%'")
        else:
            where_clauses.append(f"route_id = '{line}'")

    if min_wait:
        min_wait_seconds = int(min_wait) * 60
        where_clauses.append(f"headway_branch_seconds >= {min_wait_seconds}")

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    map_query = f"""
    SELECT 
        stop_name,
        AVG(stop_lat) as lat,
        AVG(stop_lon) as lon,
        AVG(headway_branch_seconds) as avg_wait,
        STDDEV(headway_branch_seconds) as std_dev
    FROM mbta_master_geo
    {where_sql}
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
            popup=f"""
            <b>{row['stop_name']}</b><br>
            Average Headway: {row['avg_wait']/60:.1f} minutes
            """
        ).add_to(m)
    
    # 4. Turn the map into HTML code to send to the browser
    map_html = m._repr_html_()
    
    return render_template(
        'index.html',
        map_html=map_html,
        line=line,
        min_wait=min_wait,
        day=day,
        time_of_day=time_of_day,
        month=month
    )


if __name__ == '__main__':
    app.run(debug=True)
