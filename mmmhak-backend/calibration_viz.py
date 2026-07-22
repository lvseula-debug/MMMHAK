import sys
import os
import asyncio
import numpy as np
import matplotlib.pyplot as plt

# Ensure mmmhak-backend folder is in python path
sys.path.append(os.path.dirname(__file__))

from music_analysis.emotion_engine_v2 import EmotionEngineV2
from music_analysis.projection import project_features_to_av

DATASET = [
    {
        "title": "Creep",
        "artist": "Radiohead",
        "expected": "Melancholic",
        "bpm": 92.0,
        "lyrics": "When you were here before, couldn't look you in the eye... But I'm a creep, I'm a weirdo. What the hell am I doing here? I don't belong here.",
        "audio_features": {"bpm": 92.0, "energy": 0.82, "spectral_centroid": 3200.0, "dynamic_range": 0.75, "vocal_range_energy": 0.65}
    },
    {
        "title": "Something in the Way",
        "artist": "Nirvana",
        "expected": "Desolation",
        "bpm": 105.0,
        "lyrics": "Under the bridge, the tarp has sprung a leak... Something in the way, mmm-mmm",
        "audio_features": {"bpm": 105.0, "energy": 0.25, "spectral_centroid": 1200.0, "dynamic_range": 0.45, "vocal_range_energy": 0.35}
    },
    {
        "title": "Don't Look Back in Anger",
        "artist": "Oasis",
        "expected": "Melancholic",
        "bpm": 163.0,
        "lyrics": "Slip inside the eye of your mind... Don't look back in anger, I heard you say",
        "audio_features": {"bpm": 163.0, "energy": 0.78, "spectral_centroid": 2500.0, "dynamic_range": 0.65, "vocal_range_energy": 0.55}
    },
    {
        "title": "bad guy",
        "artist": "Billie Eilish",
        "expected": "Desolation",
        "bpm": 135.0,
        "lyrics": "White shirt now red, my bloody nose... I'm that bad type, make your mama sad type",
        "audio_features": {"bpm": 135.0, "energy": 0.43, "spectral_centroid": 1800.0, "dynamic_range": 0.58, "vocal_range_energy": 0.48}
    },
    {
        "title": "Espresso",
        "artist": "Sabrina Carpenter",
        "expected": "Uplifting",
        "bpm": 120.0,
        "lyrics": "Now he's thinkin' 'bout me every night, oh... Is it that sweet? I guess so. Say you can't sleep, baby, I know, that's that me, espresso.",
        "audio_features": {"bpm": 120.0, "energy": 0.76, "spectral_centroid": 2800.0, "dynamic_range": 0.45, "vocal_range_energy": 0.60}
    },
    {
        "title": "Happy",
        "artist": "Pharrell Williams",
        "expected": "Serenity",
        "bpm": 160.0,
        "lyrics": "Because I'm happy, clap along if you feel like a room without a roof",
        "audio_features": {"bpm": 160.0, "energy": 0.96, "spectral_centroid": 3500.0, "dynamic_range": 0.70, "vocal_range_energy": 0.80}
    },
    {
        "title": "Believer",
        "artist": "Imagine Dragons",
        "expected": "Aggressive",
        "bpm": 125.0,
        "lyrics": "First things first, I'ma say all the words inside my head, I'm fired up and tired of the way that things have been",
        "audio_features": {"bpm": 125.0, "energy": 0.87, "spectral_centroid": 3100.0, "dynamic_range": 0.80, "vocal_range_energy": 0.70}
    },
    {
        "title": "Someone Like You",
        "artist": "Adele",
        "expected": "Melancholic",
        "bpm": 68.0,
        "lyrics": "Never mind, I'll find someone like you. I wish nothing but the best for you, too. Don't forget me, I beg. I'll remember you said.",
        "audio_features": {"bpm": 68.0, "energy": 0.22, "spectral_centroid": 1400.0, "dynamic_range": 0.35, "vocal_range_energy": 0.50}
    },
    {
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "expected": "Energetic",
        "bpm": 171.0,
        "lyrics": "I said, ooh, I'm blinded by the lights. No, I can't sleep until I feel your touch.",
        "audio_features": {"bpm": 171.0, "energy": 0.77, "spectral_centroid": 2900.0, "dynamic_range": 0.55, "vocal_range_energy": 0.65}
    },
    {
        "title": "Let It Be",
        "artist": "The Beatles",
        "expected": "Serenity",
        "bpm": 76.0,
        "lyrics": "When I find myself in times of trouble, Mother Mary comes to me, speaking words of wisdom, let it be.",
        "audio_features": {"bpm": 76.0, "energy": 0.45, "spectral_centroid": 1900.0, "dynamic_range": 0.40, "vocal_range_energy": 0.55}
    }
]

async def run_calibration_analysis():
    engine = EmotionEngineV2()
    results = []

    print("=== Running Quick Calibration Feature Analysis ===")
    for item in DATASET:
        lyrics_val, _ = engine.legacy_analyzer.calculate_valence(item["lyrics"])
        default_weights = {"W_h1": 0.15, "W_v": 0.12, "W_a1": 0.30, "W_a2": 0.50, "W_a3": 0.20}
        av = project_features_to_av(
            lyrics_valence=lyrics_val,
            bpm=item["audio_features"]["bpm"],
            energy=item["audio_features"]["energy"],
            spectral_centroid=item["audio_features"]["spectral_centroid"],
            dynamic_range=item["audio_features"]["dynamic_range"],
            vocal_range_energy=item["audio_features"]["vocal_range_energy"],
            weights=default_weights,
            genre_arousal_offset=0.0,
            genre_valence_offset=0.0,
            instrument_arousal_offset=0.0,
            instrument_valence_offset=0.0
        )

        v_proj = av["projected_valence"]
        a_proj = av["projected_arousal"]

        scores, actual_primary = engine._compute_rbf_mapping(v_proj, a_proj)
        matched = (actual_primary == item["expected"])

        results.append({
            "title": item["title"],
            "artist": item["artist"],
            "expected": item["expected"],
            "actual": actual_primary,
            "matched": matched,
            "projected_valence": v_proj,
            "projected_arousal": a_proj,
            "scores": scores
        })
        print(f"Track: {item['artist']:15s} - {item['title']:25s} | Projected AV: ({v_proj:6.3f}, {a_proj:6.3f}) | Exp: {item['expected']:11s} | Act: {actual_primary:11s} | Match: {matched}")

    plot_calibration(engine.centers, results)

def plot_calibration(centers, results):
    plt.figure(figsize=(11, 8.5))
    
    center_colors = {
        "Serenity": "#FFD700", "Energetic": "#FF4500", "Aggressive": "#DC143C",
        "Melancholic": "#1E90FF", "Desolation": "#8A2BE2", "Uplifting": "#FF1493"
    }

    for name, (cv, ca) in centers.items():
        plt.scatter(cv, ca, s=280, c=center_colors.get(name, "black"), marker="X", edgecolors="black", linewidths=1.8, zorder=5, label=f"Center: {name}")
        plt.text(cv + 0.02, ca + 0.02, f"{name} ({cv:.2f}, {ca:.2f})", fontsize=10, fontweight="bold", zorder=6)

    for item in results:
        v = item["projected_valence"]
        a = item["projected_arousal"]
        is_match = item["matched"]
        is_love_track = (item["expected"] == "Uplifting")

        # Use magenta star for love/uplifting tracks, circle/square for others
        if is_love_track:
            marker = "*"
            color = "#FF1493" if is_match else "#FFB6C1"
            size = 200
        else:
            marker = "o" if is_match else "s"
            color = "#00E676" if is_match else "#FF5252"
            size = 120
        
        plt.scatter(v, a, s=size, c=color, marker=marker, edgecolors="black", linewidths=1.2, zorder=4)
        
        label_text = f"{item['title']}\n[Exp: {item['expected']} | Act: {item['actual']}]"
        plt.annotate(
            label_text,
            (v, a),
            textcoords="offset points",
            xytext=(0, 12),
            ha="center",
            fontsize=8,
            bbox=dict(boxstyle="round,pad=0.3", fc="#FFF0F5" if is_love_track else ("#E8F5E9" if is_match else "#FFEBEE"), alpha=0.85),
            zorder=7
        )

    plt.title("AV Space Calibration: RBF Centers & Love/Uplifting Tracking", fontsize=14, fontweight="bold")
    plt.xlabel("Projected Valence [-1.0 to 1.0]", fontsize=12)
    plt.ylabel("Projected Arousal [0.0 to 1.0]", fontsize=12)
    plt.xlim(-1.1, 1.1)
    plt.ylim(-0.1, 1.1)
    plt.axhline(0.5, color="gray", linestyle="--", alpha=0.5)
    plt.axvline(0.0, color="gray", linestyle="--", alpha=0.5)
    plt.grid(True, linestyle=":", alpha=0.6)
    
    output_path = os.path.join(os.path.dirname(__file__), "calibration_distribution.png")
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    print(f"\nSaved calibration plot to: {output_path}")

if __name__ == "__main__":
    asyncio.run(run_calibration_analysis())
