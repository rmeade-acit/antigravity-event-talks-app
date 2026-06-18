import os
import time
import xml.etree.ElementTree as ET
import requests
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Cache configuration: Cache feed data in memory for 10 minutes
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION_SECONDS = 600  # 10 minutes
feed_cache = {
    "data": None,
    "last_fetched": 0
}

def fetch_and_parse_feed():
    """Fetches the Atom feed and parses it into a clean data structure."""
    try:
        headers = {
            "User-Agent": "BigQueryReleaseNotesExplorer/1.0 (Flask Web App)"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.content)
        
        # Atom feed namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        # Feed metadata
        feed_title_el = root.find('atom:title', ns)
        feed_updated_el = root.find('atom:updated', ns)
        
        feed_title = feed_title_el.text if feed_title_el is not None else "BigQuery - Release Notes"
        feed_updated = feed_updated_el.text if feed_updated_el is not None else ""
        
        entries = []
        for entry_el in root.findall('atom:entry', ns):
            title_el = entry_el.find('atom:title', ns)
            id_el = entry_el.find('atom:id', ns)
            updated_el = entry_el.find('atom:updated', ns)
            link_el = entry_el.find('atom:link', ns)
            content_el = entry_el.find('atom:content', ns)
            
            title = title_el.text if title_el is not None else ""
            entry_id = id_el.text if id_el is not None else ""
            updated = updated_el.text if updated_el is not None else ""
            href = link_el.attrib.get('href', '') if link_el is not None else ""
            content = content_el.text if content_el is not None else ""
            
            entries.append({
                'title': title,
                'id': entry_id,
                'updated': updated,
                'link': href,
                'content': content
            })
            
        return {
            "success": True,
            "title": feed_title,
            "updated": feed_updated,
            "entries": entries,
            "source": "live"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/api/notes')
def get_release_notes():
    """API endpoint to get release notes, using cache when appropriate."""
    force_refresh = request.args.get('refresh', '').lower() == 'true'
    current_time = time.time()
    
    # Check cache validity
    if not force_refresh and feed_cache["data"] and (current_time - feed_cache["last_fetched"] < CACHE_DURATION_SECONDS):
        response_data = feed_cache["data"].copy()
        response_data["source"] = "cache"
        response_data["cache_age_seconds"] = int(current_time - feed_cache["last_fetched"])
        return jsonify(response_data)
    
    # Fetch live data
    result = fetch_and_parse_feed()
    if result["success"]:
        feed_cache["data"] = result
        feed_cache["last_fetched"] = current_time
        return jsonify(result)
    else:
        # If fetch fails but we have cached data, fallback to cache
        if feed_cache["data"]:
            fallback_data = feed_cache["data"].copy()
            fallback_data["source"] = "cache_fallback"
            fallback_data["warning"] = f"Failed to refresh feed: {result['error']}. Using stale cache."
            return jsonify(fallback_data)
        return jsonify({"success": False, "error": result["error"]}), 500

if __name__ == '__main__':
    # Run the application on local port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
