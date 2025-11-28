import { map, tileLayer, control, Icon, icon, marker, popup, latLng } from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MAP_SERVICE_API_KEY } from '../config';
export default class Map {
  #zoom = 5;
  #map = null;
  static _instances = {};
  static async getPlaceNameByCoordinate(latitude, longitude) {
    try {
      const url = new URL(`https://api.maptiler.com/geocoding/${longitude},${latitude}.json`);
      url.searchParams.set('key', MAP_SERVICE_API_KEY);
      url.searchParams.set('language', 'id');
      url.searchParams.set('limit', '1');
      const response = await fetch(url);
      const json = await response.json();
      const place = json.features[0].place_name.split(', ');
      return [place.at(-2), place.at(-1)].map((name) => name).join(', ');
    } catch (error) {
      console.error('getPlaceNameByCoordinate: error:', error);
      return `${latitude}, ${longitude}`;
    }
  }
  static isGeolocationAvailable() {
    return 'geolocation' in navigator;
  }

  static getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!Map.isGeolocationAvailable()) {
        reject('Geolocation API unsupported');
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  /**
   * Reference of using this static method:
   * https://stackoverflow.com/questions/43431550/how-can-i-invoke-asynchronous-code-within-a-constructor
   * */
  static async build(selector, options = {}) {
    // If an instance for this selector already exists, attempt to reuse it
    if (Map._instances && Map._instances[selector]) {
      const existing = Map._instances[selector];
      const container = document.querySelector(selector);

      // If container is missing or the existing map is attached to a different container,
      // remove the existing map and recreate a fresh instance.
      try {
        const existingContainer = existing.#map.getContainer();
        if (!container || existingContainer !== container) {
          try {
            existing.#map.remove();
          } catch (e) {
            // ignore remove errors
          }
          delete Map._instances[selector];
        } else {
          // If new center provided, update camera
          if ('center' in options && options.center) {
            existing.changeCamera(options.center, options.zoom);
          }
          return existing;
        }
      } catch (err) {
        // If any error accessing existing map internals, clear instance and continue
        try {
          existing.#map.remove();
        } catch (e) {}
        delete Map._instances[selector];
      }
    }

    if ('center' in options && options.center) {
      return new Map(selector, options);
    }

    const jakartaCoordinate = [-6.2, 106.816666];

    // Using Geolocation API
    if ('locate' in options && options.locate) {
      try {
        const position = await Map.getCurrentPosition();
        const coordinate = [position.coords.latitude, position.coords.longitude];

        return new Map(selector, {
          ...options,
          center: coordinate,
        });
      } catch (error) {
        console.error('build: error:', error);

        return new Map(selector, {
          ...options,
          center: jakartaCoordinate,
        });
      }
    }

    return new Map(selector, {
      ...options,
      center: jakartaCoordinate,
    });
  }

  constructor(selector, options = {}) {
    this.#zoom = options.zoom ?? this.#zoom;

    // MapTiler base layers (using provided MAP_SERVICE_API_KEY from config)
    const key = MAP_SERVICE_API_KEY;

    const tileMapTilerSatellite = tileLayer(
      `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`,
      {
        attribution:
          '© <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> | © <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>',
        maxZoom: 20,
      },
    );

    const tileOsm = tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    });

    // Initialize map with Satellite layer as default (streets layer removed)
    this.#map = map(document.querySelector(selector), {
      zoom: this.#zoom,
      scrollWheelZoom: false,
      layers: [tileMapTilerSatellite],
      ...options,
    });

    // register instance to avoid duplicate initialization on same selector
    try {
      Map._instances[selector] = this;
    } catch (e) {
      // ignore registration errors
    }

    // Add layer control allowing users to switch between Satellite and OpenStreetMap
    const baseLayers = {
      Satellite: tileMapTilerSatellite,
      OpenStreetMap: tileOsm,
    };

    control.layers(baseLayers).addTo(this.#map);
  }

  changeCamera(coordinate, zoomLevel = null) {
    if (!zoomLevel) {
      this.#map.setView(latLng(coordinate), this.#zoom);
      return;
    }
    this.#map.setView(latLng(coordinate), zoomLevel);
  }
  getCenter() {
    const { lat, lng } = this.#map.getCenter();
    return {
      latitude: lat,
      longitude: lng,
    };
  }
  createIcon(options = {}) {
    return icon({
      ...Icon.Default.prototype.options,
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
      ...options,
    });
  }
  addMarker(coordinates, markerOptions = {}, popupOptions = null) {
    if (typeof markerOptions !== 'object') {
      throw new Error('markerOptions must be an object');
    }
    const newMarker = marker(coordinates, {
      icon: this.createIcon(),
      ...markerOptions,
    });
    if (popupOptions) {
      if (typeof popupOptions !== 'object') {
        throw new Error('popupOptions must be an object');
      }
      if (!('content' in popupOptions)) {
        throw new Error('popupOptions must include `content` property.');
      }
      const newPopup = popup(coordinates, popupOptions);
      newMarker.bindPopup(newPopup);
    }
    newMarker.addTo(this.#map);
    return newMarker;
  }
  addMapEventListener(eventName, callback) {
    this.#map.addEventListener(eventName, callback);
  }
}
