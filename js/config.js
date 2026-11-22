/* Hello Dorking town-centre map — full directory preview (local only, not published). */

window.MAP_PROVIDER = {
  library: 'maplibre',
  mapboxToken: ''
};

window.MAP_START = {
  // Pump Corner, looking along High Street / West Street / South Street
  center: [-0.3334, 51.2320],
  zoom: 15.4,
  phoneBounds: [[-0.3372, 51.2296], [-0.3276, 51.2346]]
};

window.BASEMAPS = {
  map: { label: 'Map', style: 'https://tiles.openfreemap.org/styles/positron' },
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  }
};

window.ICONS = {
  cafe: 'M4 5h10v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5zm10 2h3a3 3 0 0 1 0 6h-3M8 19v2m4-2v2',
  bag: 'M6 7h12l-1 13H7L6 7zm3 0V5a3 3 0 0 1 6 0v2',
  spa: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z',
  ticket: 'M4 8a2 2 0 0 1 0-4h16a2 2 0 0 1 0 4v8a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4V8z',
  bed: 'M3 10h18v8H3zM3 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M3 14h18',
  briefcase: 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12H4z',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7z',
  pin: 'M12 21s-7-4.4-7-10a7 7 0 0 1 14 0c0 5.6-7 10-7 10zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  parking: 'M7 3h7a5 5 0 0 1 0 10H11v8H7V3zm4 3v4h3a2 2 0 0 0 0-4h-3z',
  toilet: 'M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 21V11h6v10H8v-6H6v6H4zm13-13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm-3 13V11h2l2 6 2-6h2v10h-2v-6l-2 6h-2l-2-6v6h-2z'
};

window.EXPLORE_HIDDEN = ['Professional', 'Services'];

window.LAYERS = [
  {
    id: 'businesses',
    name: 'Businesses',
    file: 'data/businesses.csv',
    colour: '#ad061a',
    icon: 'bag',
    categoryField: 'Category',
    defaultHiddenCategories: window.EXPLORE_HIDDEN,
    categories: {
      'Food & drink': '#ad061a',
      'Shops': '#25483f',
      'Health & beauty': '#143548',
      'Leisure & culture': '#5b6d4a',
      'Accommodation': '#7a4a32',
      'Professional': '#5c6b73',
      'Services': '#3d5c66',
      'Other': '#6a5c4a'
    },
    categoryIcons: {
      'Food & drink': 'cafe',
      'Shops': 'bag',
      'Health & beauty': 'spa',
      'Leisure & culture': 'ticket',
      'Accommodation': 'bed',
      'Professional': 'briefcase',
      'Services': 'wrench',
      'Other': 'pin'
    },
    fields: {
      name: 'Name',
      description: 'Short_Description',
      website: 'Website',
      address: ['Address', 'Postcode'],
      precision: 'Coord_Precision',
      phone: 'Phone',
      instagram: 'Instagram',
      hours: 'Opening_Hours_Note',
      independent: 'Independent',
      photo: 'Photo',
      photoCredit: 'Photo_Credit',
      category: 'Category',
      subcategory: 'Subcategory'
    }
  },
  {
    id: 'parking',
    name: 'Car parks',
    file: 'data/carparks.csv',
    colour: '#5b6d4a',
    icon: 'parking',
    categoryField: 'Stay',
    categories: {
      'Long and short stay': '#5b6d4a',
      'Short stay': '#8a9a74',
      'Long stay': '#3e4f38',
      'Saturday only': '#7a4a32'
    },
    categoryPinClass: {
      'Long and short stay': 'pin-sm',
      'Short stay': 'pin-sm',
      'Long stay': 'pin-sm',
      'Saturday only': 'pin-sm'
    },
    fields: {
      name: 'Name',
      description: 'Short_Description',
      website: 'Website',
      address: ['Address', 'Postcode'],
      precision: 'Coord_Precision',
      hours: 'Opening_Hours_Note',
      category: 'Stay',
      subcategory: 'Stay'
    }
  },
  {
    id: 'toilets',
    name: 'Toilets',
    file: 'data/toilets.csv',
    colour: '#143548',
    icon: 'toilet',
    categoryField: 'Kind',
    categories: {
      'Public toilet': '#143548',
      'Changing Places': '#25483f',
      'Toilets welcome': '#4a6570'
    },
    categoryPinClass: {
      'Public toilet': 'pin-sm',
      'Changing Places': 'pin-sm',
      'Toilets welcome': 'pin-sm'
    },
    fields: {
      name: 'Name',
      description: 'Short_Description',
      website: 'Website',
      address: ['Address', 'Postcode'],
      precision: 'Coord_Precision',
      hours: 'Opening_Hours_Note',
      category: 'Kind',
      subcategory: 'Kind'
    }
  }
];

window.NEWSLETTER = { enabled: false, text: '', url: '#' };

window.TELL_US = { email: '', subject: '', body: '' };

window.ANALYTICS = { goatcounterCode: '' };
