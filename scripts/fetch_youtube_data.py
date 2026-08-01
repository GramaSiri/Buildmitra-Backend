import re
import json
import urllib.request
import urllib.parse
import sys

STAGES = [
    (1, "Site inspection and site marking"),
    (2, "Soil testing"),
    (3, "Survey and layout marking"),
    (4, "Excavation"),
    (5, "PCC work"),
    (6, "Footing reinforcement"),
    (7, "Footing concreting"),
    (8, "Foundation and pedestal"),
    (9, "Plinth beam"),
    (10, "Backfilling and compaction"),
    (11, "Anti-termite treatment"),
    (12, "Ground-floor slab"),
    (13, "Column reinforcement and casting"),
    (14, "Beam reinforcement"),
    (15, "Slab shuttering"),
    (16, "Slab reinforcement"),
    (17, "Electrical slab conduits"),
    (18, "Plumbing sleeve work"),
    (19, "Slab concreting"),
    (20, "Blockwork and brickwork"),
    (21, "Door and window frames"),
    (22, "Internal plastering"),
    (23, "External plastering"),
    (24, "Waterproofing"),
    (25, "Plumbing concealed work"),
    (26, "Electrical concealed work"),
    (27, "Flooring and tile work"),
    (28, "False ceiling"),
    (29, "Painting and putty"),
    (30, "Doors, windows and grills"),
    (31, "Sanitary fixture installation"),
    (32, "Electrical fixture installation"),
    (33, "Kitchen installation"),
    (34, "External development and drainage"),
    (35, "Compound wall and gate"),
    (36, "Elevation finishing"),
    (37, "Testing and commissioning"),
    (38, "Cleaning"),
    (39, "Snag inspection"),
    (40, "Snag rectification and final handover")
]

LANGUAGES = ["Kannada", "Hindi", "English"]

def search_youtube(query, max_results=3):
    encoded_query = urllib.parse.quote(query)
    url = f"https://www.youtube.com/results?search_query={encoded_query}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    )
    
    videos = []
    try:
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        # Extract initialData JSON from youtube HTML
        pattern = r"var ytInitialData = ({.*?});</script>"
        match = re.search(pattern, html)
        if match:
            data = json.loads(match.group(1))
            contents = data.get("contents", {}).get("twoColumnSearchResultsRenderer", {}).get("primaryContents", {}).get("sectionListRenderer", {}).get("contents", [])
            for section in contents:
                item_section = section.get("itemSectionRenderer", {}).get("contents", [])
                for item in item_section:
                    v = item.get("videoRenderer")
                    if v:
                        video_id = v.get("videoId")
                        title = v.get("title", {}).get("runs", [{}])[0].get("text", "")
                        channel = v.get("ownerText", {}).get("runs", [{}])[0].get("text", "Civil Engineering Guide")
                        duration = v.get("lengthText", {}).get("simpleText", "8:30")
                        
                        # Exclude shorts if they are pure shorts or very brief
                        if video_id and title and not "shorts" in title.lower():
                            videos.append({
                                "youtubeId": video_id,
                                "youtubeUrl": f"https://www.youtube.com/watch?v={video_id}",
                                "videoTitle": title,
                                "channelName": channel,
                                "duration": duration
                            })
                            if len(videos) >= max_results:
                                break
                if len(videos) >= max_results:
                    break
    except Exception as e:
        print(f"Error searching query '{query}': {e}", file=sys.stderr)
    return videos

def build_seed_data():
    all_videos = []
    seen_ids = set()
    
    print("Searching YouTube for 40 construction stages...")
    
    for stage_num, stage_name in STAGES:
        print(f"Searching Stage {stage_num}: {stage_name}...")
        stage_videos = []
        
        # 1. Search Kannada
        query_kannada = f"{stage_name} house construction in Kannada"
        results_kn = search_youtube(query_kannada, max_results=2)
        for r in results_kn:
            if r["youtubeId"] not in seen_ids:
                seen_ids.add(r["youtubeId"])
                stage_videos.append({
                    "stageNumber": stage_num,
                    "stageName": stage_name,
                    "videoTitle": r["videoTitle"],
                    "youtubeUrl": r["youtubeUrl"],
                    "youtubeId": r["youtubeId"],
                    "language": "Kannada",
                    "channelName": r["channelName"],
                    "duration": r["duration"],
                    "shortDescription": f"Detailed step-by-step practical guide for {stage_name} in Kannada for house building.",
                    "displayOrder": len(stage_videos) + 1,
                    "isActive": True
                })
        
        # 2. Search Hindi if needed or to enrich
        query_hindi = f"{stage_name} residential house construction in Hindi"
        results_hi = search_youtube(query_hindi, max_results=2)
        for r in results_hi:
            if r["youtubeId"] not in seen_ids and len(stage_videos) < 3:
                seen_ids.add(r["youtubeId"])
                stage_videos.append({
                    "stageNumber": stage_num,
                    "stageName": stage_name,
                    "videoTitle": r["videoTitle"],
                    "youtubeUrl": r["youtubeUrl"],
                    "youtubeId": r["youtubeId"],
                    "language": "Hindi",
                    "channelName": r["channelName"],
                    "duration": r["duration"],
                    "shortDescription": f"Practical civil engineering field execution for {stage_name} explained in Hindi.",
                    "displayOrder": len(stage_videos) + 1,
                    "isActive": True
                })

        # 3. Search English if needed
        if len(stage_videos) < 2:
            query_en = f"{stage_name} site work residential construction"
            results_en = search_youtube(query_en, max_results=2)
            for r in results_en:
                if r["youtubeId"] not in seen_ids and len(stage_videos) < 3:
                    seen_ids.add(r["youtubeId"])
                    stage_videos.append({
                        "stageNumber": stage_num,
                        "stageName": stage_name,
                        "videoTitle": r["videoTitle"],
                        "youtubeUrl": r["youtubeUrl"],
                        "youtubeId": r["youtubeId"],
                        "language": "English",
                        "channelName": r["channelName"],
                        "duration": r["duration"],
                        "shortDescription": f"Professional site execution standard & guidelines for {stage_name}.",
                        "displayOrder": len(stage_videos) + 1,
                        "isActive": True
                    })

        all_videos.extend(stage_videos)
        print(f"  -> Added {len(stage_videos)} videos for Stage {stage_num}.")

    print(f"\nTotal videos collected: {len(all_videos)}")
    
    with open("d:/images/Desktop/BMBackend/scripts/construction_videos_seed.json", "w", encoding="utf-8") as f:
        json.dump(all_videos, f, indent=2, ensure_ascii=False)
    
    print("Saved to d:/images/Desktop/BMBackend/scripts/construction_videos_seed.json")

if __name__ == "__main__":
    build_seed_data()
