from flask import Flask, render_template, request, jsonify
import duckdb
import os
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import pandas as pd

app = Flask(__name__)

# Render the main page
@app.route('/')
def index():
    return render_template('index.html')

# Data endpoint for the D3 map
@app.route('/data')
def data():
    # Connect to the database
    con = duckdb.connect('mbta_data.db')

    # Get filters from the frontend
    line = request.args.get('line')
    stop = request.args.get('stop')
    day = request.args.get('day')
    time_of_day = request.args.get('time_of_day')
    month = request.args.get('month')

    where_clauses = []
    params = []

    # Filter Logic
    if stop and stop != "":
        where_clauses.append("stop_name = ?")
        params.append(stop)
    elif line:
        if line:
            if line == "Medford/Tufts":
                # The complete Green Line E path from Medford to Heath Street
                e_branch_stops = (
                    'Medford/Tufts', 'Ball Square', 'Magoun Square', 
                    'Gilman Square', 'East Somerville', 'Lechmere', 
                    'Science Park/West End', 'North Station', 'Haymarket', 
                    'Government Center', 'Park Street', 'Boylston', 
                    'Arlington', 'Copley', 'Prudential', 'Symphony', 
                    'Northeastern University', 'Museum of Fine Arts', 
                    'Longwood Medical Area', 'Brigham Circle', 'Fenwood Road', 
                    'Mission Park', 'Riverway', 'Back of the Hill', 'Heath Street'
                )
                where_clauses.append("stop_name IN " + str(e_branch_stops))
            elif line == "Green":
                where_clauses.append("route_id LIKE 'Green%'")
            else:
                where_clauses.append("route_id = ?")
                params.append(line)
    if day and day != "":
        where_clauses.append("dayname(service_date) = ?")
        params.append(day)

    if month and month != "":
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

    # Construct the WHERE SQL
    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    # The Query
    query = f"""
        SELECT 
            stop_name,
            AVG(stop_lat) AS lat,
            AVG(stop_lon) AS lon,
            COUNT(*) AS record_count,
            AVG(headway_branch_seconds) AS avg_wait,
            STDDEV(headway_branch_seconds) AS std_dev
        FROM mbta_master_geo
        {where_sql}
        GROUP BY stop_name
    """

    # # Execute and convert to dictionary
    # df = con.execute(query, params).df().fillna(0)
    
    # return jsonify(df.to_dict(orient="records"))
    df = con.execute(query, params).df().fillna(0)

# ---------- K-MEANS CLUSTERING ----------
    if len(df) >= 3:
        features = df[["avg_wait", "std_dev"]]

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(features)

        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        df["cluster"] = kmeans.fit_predict(X_scaled)

        # Interpret clusters based on average wait + variability
        cluster_summary = (
            df.groupby("cluster")[["avg_wait", "std_dev"]]
            .mean()
            .sum(axis=1)
            .sort_values()
        )

        label_map = {}
        labels = ["Reliable Service", "Moderate Issues", "Unreliable Service"]

        for cluster_id, label in zip(cluster_summary.index, labels):
            label_map[cluster_id] = label

        df["cluster_label"] = df["cluster"].map(label_map)
    else:
        df["cluster"] = 0
        df["cluster_label"] = "Not enough data"

    return jsonify(df.to_dict(orient="records"))

if __name__ == '__main__':
    # Using use_reloader=False can sometimes help on Macs if it crashes
    app.run(debug=True, port=5000)