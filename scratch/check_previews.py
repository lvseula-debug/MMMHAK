import httpx
import urllib.parse
import sys

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

r = httpx.get('https://ws.audioscrobbler.com/2.0/?method=chart.getTopTracks&api_key=8031c3fd85fae84e3a1970b02e22a231&format=json&limit=50').json()
tracks = r['tracks']['track']

print(f"Total tracks to analyze: {len(tracks)}")

for idx, t in enumerate(tracks):
    title = t['name']
    artist = t['artist']['name']
    q = f"{title} {artist}"
    
    try:
        # Simulate frontend direct fetch
        escaped_q = urllib.parse.quote(q)
        res_data = httpx.get(f"https://itunes.apple.com/search?term={escaped_q}&entity=song&limit=5").json()
        results = res_data.get('results', [])
        
        if not results:
            print(f"{idx+1}: FAIL (No results at all) - '{title}' by '{artist}'")
            continue
            
        # Match search logic in App.jsx
        match = None
        for r_item in results:
            artist_name = r_item.get('artistName', '').lower()
            track_name = r_item.get('trackName', '').lower()
            first_word_artist = artist.lower().split()[0] if artist.split() else ""
            first_word_title = title.lower().split()[0] if title.split() else ""
            
            if (first_word_artist and first_word_artist in artist_name) or (first_word_title and first_word_title in track_name):
                match = r_item
                break
                
        if not match:
            match = results[0]  # Fallback to first item if match find fails
            
        preview_url = match.get('previewUrl')
        if not preview_url:
            print(f"{idx+1}: FAIL (Match found but previewUrl is missing/null) - '{title}' by '{artist}' (Match: '{match.get('trackName')}' by '{match.get('artistName')}')")
        else:
            # Success
            pass
            
    except Exception as e:
        print(f"{idx+1}: ERROR - '{title}' by '{artist}': {e}")
