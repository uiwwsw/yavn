export const usageConfig = {
  "service": "yavn",
  "origin": "https://yavn.vercel.app",
  "hosts": [
    "yavn.vercel.app"
  ],
  "routes": [
    {
      "match": "^/$",
      "path": "/",
      "name": "launcher"
    },
    {
      "match": "^/en/?$",
      "path": "/en/",
      "name": "launcher_en"
    },
    {
      "match": "^/create/?$",
      "path": "/create/",
      "name": "creator_guide"
    },
    {
      "match": "^/en/create/?$",
      "path": "/en/create/",
      "name": "creator_guide_en"
    },
    {
      "match": "^/game-list/[^/]+/?$",
      "path": "/game-list/:game/",
      "name": "game_start"
    },
    {
      "match": "^$",
      "path": "/screens/play",
      "name": "play"
    },
    {
      "match": "^$",
      "path": "/screens/history",
      "name": "history"
    },
    {
      "match": "^$",
      "path": "/screens/inventory",
      "name": "inventory"
    },
    {
      "match": "^$",
      "path": "/screens/settings",
      "name": "settings"
    },
    {
      "match": "^$",
      "path": "/screens/story_map",
      "name": "story_map"
    },
    {
      "match": "^$",
      "path": "/screens/ending",
      "name": "ending"
    }
  ]
};
export function usageTag() {
  const data = JSON.stringify(usageConfig).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return `<script type="module" src="${usageConfig.script || '/usage-analytics.js'}" data-usage-config="${data}"></script>`;
}
