/**
 * master-data.js
 * マスターデータ（競技・ホテル・会場）を直接埋め込み。
 * サーバー不要でファイルをダブルクリックして開けます。
 */
const EMBEDDED_MASTER = {
  "version": "1.0",
  "lastModified": "2026-03-10",
  "dateRange": { "start": "2026-09-10", "end": "2026-10-07" },
  "sports": [
    { "id": "soccer_w",       "name": "サッカー（女子）",            "shortName": "サッカー",        "isSoccer": true,  "color": "#e74c3c", "venueIds": ["venue_nagoya_port","venue_wave_kariya","venue_nagaragawa","venue_ecopa","venue_nagai"], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "athletics",      "name": "陸上（TF）",                  "shortName": "陸上",            "isSoccer": false, "color": "#3498db", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "badminton",      "name": "バドミントン",                 "shortName": "バドミントン",    "isSoccer": false, "color": "#2ecc71", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "basketball_3x3", "name": "バスケットボール（3×3）",     "shortName": "バスケ3×3",      "isSoccer": false, "color": "#f39c12", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "gymnastics",     "name": "体操",                        "shortName": "体操",            "isSoccer": false, "color": "#9b59b6", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "handball",       "name": "ハンドボール",                 "shortName": "ハンドボール",    "isSoccer": false, "color": "#1abc9c", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "karate",         "name": "空手",                        "shortName": "空手",            "isSoccer": false, "color": "#e67e22", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "table_tennis",   "name": "卓球",                        "shortName": "卓球",            "isSoccer": false, "color": "#c0392b", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "soft_tennis",    "name": "ソフトテニス",                 "shortName": "ソフトテニス",    "isSoccer": false, "color": "#27ae60", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "archery",        "name": "アーチェリー",                 "shortName": "アーチェリー",    "isSoccer": false, "color": "#2980b9", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "boxing",         "name": "ボクシング",                   "shortName": "ボクシング",      "isSoccer": false, "color": "#922b21", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "canoe_kayak",    "name": "カヌーカヤック（スプリント）", "shortName": "カヌー",          "isSoccer": false, "color": "#16a085", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "judo",           "name": "柔道",                        "shortName": "柔道",            "isSoccer": false, "color": "#8e44ad", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "shooting",       "name": "射撃",                        "shortName": "射撃",            "isSoccer": false, "color": "#7f8c8d", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "volleyball",     "name": "バレーボール",                 "shortName": "バレーボール",    "isSoccer": false, "color": "#d35400", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "weightlifting",  "name": "ウェイトリフティング",          "shortName": "ウェイトリフティング", "isSoccer": false, "color": "#2c3e50", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "wrestling",      "name": "レスリング",                   "shortName": "レスリング",      "isSoccer": false, "color": "#d4ac0d", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "artistic_swimming", "name": "アーティスティックスイミング", "shortName": "アーティスティック", "isSoccer": false, "color": "#5dade2", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" },
    { "id": "diving",         "name": "飛込",                         "shortName": "飛込",            "isSoccer": false, "color": "#48c9b0", "venueIds": [], "hotelIds": [], "startDate": "", "endDate": "", "note": "" }
  ],
  "hotels": [
    { "id": "hotel_iris_aichi",       "name": "アイリス愛知",                     "address": "", "tel": "", "sportIds": [], "color": "#e74c3c", "note": "" },
    { "id": "hotel_aichi_kenpo",      "name": "あいち健康プラザホテル",           "address": "", "tel": "", "sportIds": [], "color": "#3498db", "note": "" },
    { "id": "hotel_concord_hamamatsu","name": "ホテルコンコルド浜松",             "address": "", "tel": "", "sportIds": [], "color": "#2ecc71", "note": "" },
    { "id": "hotel_tokyo_bay_shiomi", "name": "東京ベイ潮見プリンスホテル",       "address": "", "tel": "", "sportIds": [], "color": "#f39c12", "note": "" },
    { "id": "hotel_tsumakoi",         "name": "つま恋リゾート 彩の郷",            "address": "", "tel": "", "sportIds": [], "color": "#9b59b6", "note": "" },
    { "id": "hotel_kakegawa_grand",   "name": "掛川グランドホテル",               "address": "", "tel": "", "sportIds": [], "color": "#1abc9c", "note": "" },
    { "id": "hotel_agora_osaka",      "name": "ホテルアゴーラリージェンシー大阪堺", "address": "", "tel": "", "sportIds": [], "color": "#e67e22", "note": "" }
  ],
  "venues": [
    { "id": "venue_nagoya_port", "name": "名古屋市港サッカー場",                   "sportId": "soccer_w", "hotelId": "", "address": "", "note": "" },
    { "id": "venue_wave_kariya", "name": "ウェーブスタジアム刈谷",                 "sportId": "soccer_w", "hotelId": "", "address": "", "note": "" },
    { "id": "venue_nagaragawa",  "name": "長良川競技場",                           "sportId": "soccer_w", "hotelId": "", "address": "", "note": "" },
    { "id": "venue_ecopa",       "name": "小笠山総合運動公園エコパスタジアム",     "sportId": "soccer_w", "hotelId": "", "address": "", "note": "" },
    { "id": "venue_nagai",       "name": "長居陸上競技場",                         "sportId": "soccer_w", "hotelId": "", "address": "", "note": "" }
  ],
  "soccerGroups": [],
  "soccerMatches": [],
  "eventCategories": [
    { "id": "wakeup",      "name": "起床・就寝",          "color": "#95a5a6" },
    { "id": "meal",        "name": "食事",                "color": "#f39c12" },
    { "id": "training",    "name": "練習・トレーニング",    "color": "#3498db" },
    { "id": "competition", "name": "競技",                "color": "#e74c3c" },
    { "id": "transport",   "name": "移動・交通",           "color": "#9b59b6" },
    { "id": "meeting",     "name": "ミーティング",         "color": "#1abc9c" },
    { "id": "medical",     "name": "医療・ケア",           "color": "#27ae60" },
    { "id": "rest",        "name": "休息・自由時間",       "color": "#bdc3c7" },
    { "id": "checkin",     "name": "チェックイン/アウト",  "color": "#2c3e50" },
    { "id": "other",       "name": "その他",              "color": "#7f8c8d" }
  ]
};
