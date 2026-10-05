/* Themed worlds: 6 levels each across 30-level classic campaign (render + copy only). */
(function attachTurdanoidWorlds(root) {
  'use strict';

  const WORLDS = [
    {
      id: 'bathroom',
      name: 'Bathroom Tiles',
      sky: ['#0a1a22', '#12303a', '#1a4548'],
      accent: '#9effc8',
      wallMortar: '#061714',
      pipe: ['#1a3d4a', '#5a9aaa', '#2a5560'],
      playWallTint: 'rgba(120,220,200,.14)'
    },
    {
      id: 'sewer',
      name: 'Sewer Pipes',
      sky: ['#06141a', '#0e2730', '#15394a'],
      accent: '#7af1c4',
      wallMortar: '#061714',
      pipe: ['#0f2b24', '#2f6b58', '#1d4a3c'],
      playWallTint: 'rgba(90,200,170,.12)'
    },
    {
      id: 'toxic',
      name: 'Toxic Lagoon',
      sky: ['#0a1810', '#142818', '#1e3820'],
      accent: '#b8ff7a',
      wallMortar: '#0a1408',
      pipe: ['#1a3020', '#3d7a48', '#254a30'],
      playWallTint: 'rgba(140,255,100,.11)'
    },
    {
      id: 'candy',
      name: 'Candy Clog',
      sky: ['#1a1020', '#2a1838', '#3a2048'],
      accent: '#ff9de8',
      wallMortar: '#180818',
      pipe: ['#4a2048', '#c23d8a', '#6a2860'],
      playWallTint: 'rgba(255,120,220,.13)'
    },
    {
      id: 'throne',
      name: 'Golden Throne',
      sky: ['#1a1408', '#2a2010', '#3a2c14'],
      accent: '#ffd76a',
      wallMortar: '#141008',
      pipe: ['#3a2a10', '#bf8a13', '#5a4018'],
      playWallTint: 'rgba(255,210,80,.12)'
    }
  ];

  function worldIndexForLevel(level) {
    const lv = Math.max(1, Math.floor(level || 1));
    return Math.min(WORLDS.length - 1, Math.floor((lv - 1) / 6));
  }

  function worldForLevel(level) {
    return WORLDS[worldIndexForLevel(level)];
  }

  function levelIntroLine(level, patternName) {
    const w = worldForLevel(level);
    const pat = patternName || 'Classic';
    return `${w.name} · Level ${level} · ${pat}`;
  }

  root.TurdanoidWorlds = {
    WORLDS,
    worldIndexForLevel,
    worldForLevel,
    levelIntroLine
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
