from flask import Flask, render_template, request, jsonify
import duckdb
import folium
import os

app = Flask(__name__)

# Render page
@app.route('/')
def index():
    return render_template('index.html')


# Data endpoint for D3
@app.route('/data')
def data():
    con = duckdb.connect('mbta_data.db')

    line = request.args.get('line')
    day = request.args.get('day')
    time_of_day = request.args.get('time_of_day')
    month = request.args.get('month')

    where_clauses = []
    params = []

    if day:
        where_clauses.append("dayname(service_date) = ?")
        params.append(day)

    if month:
        where_clauses.append("month(service_date) = ?")
        params.append(int(month))

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
            where_clauses.append("route_id = ?")
            params.append(line)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    query = f"""
        SELECT 
            stop_name,
            AVG(stop_lat) AS lat,
            AVG(stop_lon) AS lon,
            AVG(headway_branch_seconds) AS avg_wait,
            STDDEV(headway_branch_seconds) AS std_dev
        FROM mbta_master_geo
        {where_sql}
        GROUP BY stop_name
    """

    df = con.execute(query, params).df().fillna(0)

    return jsonify(df.to_dict(orient="records"))


if __name__ == '__main__':
    app.run(debug=True)


