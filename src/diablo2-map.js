/* globals customElements, fetch */

import monsterNamesRaw from 'diablo2-data/data/pod_1.13d/monster_names.txt'
import objectsRaw from 'diablo2-data/data/pod_1.13d/objects.txt'
import { LitElement, html } from 'lit-element'
import L from 'leaflet'
import css from 'leaflet/dist/leaflet.css'
import 'leaflet.awesome-markers'
import cssMarkers from 'leaflet.awesome-markers/dist/leaflet.awesome-markers.css'
import 'leaflet-search'
import cssSearch from 'leaflet-search/dist/leaflet-search.src.css'
import torch from './assets/torch.png'
import fallen from './assets/fallen.png'
import waypoint from './assets/waypoint.png'
import sorceress from './assets/sorceress.png'
import barbarian from './assets/barbarian.png'
import wall from './assets/wall.png'
import ground from './assets/ground.png'

const torchIcon = L.icon({
  iconUrl: torch,
  iconSize: [30, 30]
})

const fallenIcon = L.icon({
  iconUrl: fallen,
  iconSize: [30, 30]
})

const waypointIcon = L.icon({
  iconUrl: waypoint,
  iconSize: [30, 30]
})

const sorceressIcon = L.icon({
  iconUrl: sorceress,
  iconSize: [60, 60]
})

const barbarianIcon = L.icon({
  iconUrl: barbarian,
  iconSize: [30, 30]
})

const wallIcon = L.icon({
  iconUrl: wall,
  iconSize: [15, 15]
})

const groundIcon = L.icon({
  iconUrl: ground,
  iconSize: [15, 15]
})

function loadCsv (txt) {
  const lines = txt.split('\n')
  const header = lines.shift().split('\t')
  return lines
    .map(line => line.split('\t'))
    .map(arr => arr.reduce((acc, e, i) => {
      acc[header[i]] = e
      return acc
    }, {}))
}

const objects = loadCsv(objectsRaw)

const objectsById = objects.reduce((acc, object) => {
  acc[parseInt(object['Id'])] = object
  return acc
}, {})

/* This code is needed to properly load the images in the Leaflet CSS */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
})

const monsterNames = monsterNamesRaw.split('\n')

function transformCoords ({ x, y }) {
  return { x: x, y: -y }
}

const yx = L.latLng

const xy = function (x, y) {
  if (L.Util.isArray(x)) { // When doing xy([x, y]);
    return yx(x[1], x[0])
  }
  return yx(y, x) // When doing xy(x, y);
}

class Diablo2Map extends LitElement {
  static get properties () {
    return {
      ws: { type: Object }
    }
  }

  firstUpdated () {
    this.displayMap()
  }

  static addMarker (layer, pos, color, title, permanent = true, icon = null) {
    const marker = L.marker(pos, { icon: icon === null ? Diablo2Map.createIcon(color) : icon, title })
    layer.addLayer(marker)
    marker.bindTooltip(title, { permanent, direction: 'right' })
    return marker
  }

  displayNpc (x, y, unitId, unitCode) {
    ({ x, y } = transformCoords({ x, y }))
    const pos = xy(x, y)
    const name = (unitCode !== undefined ? (monsterNames[unitCode] !== '' ? monsterNames[unitCode] : ('NPC ' + unitCode)) : 'NPC')
    if (this.npcs[unitId] === undefined) {
      this.npcs[unitId] = Diablo2Map.addMarker(this.npcLayer, pos, 'green', name + ' ' + unitId, false, fallenIcon)
    } else {
      this.npcs[unitId].setLatLng(pos)
      if (unitCode !== undefined) {
        this.npcLayer.removeLayer(this.npcs[unitId])
        this.npcs[unitId] = Diablo2Map.addMarker(this.npcLayer, pos, 'green', name + ' ' + unitId, false, fallenIcon)
      }
    }
    if (!this.positionned) {
      this.map.panTo(pos)
      this.positionned = true
    }
  }

  displayPlayerMove (x, y, unitId, name) {
    ({ x, y } = transformCoords({ x, y }))
    const pos = xy(x, y)
    if (this.players[unitId] === undefined) {
      this.players[unitId] = Diablo2Map.addMarker(this.playerLayer, pos, 'blue', name !== undefined ? name : 'player ' + unitId, false, barbarianIcon)
    } else {
      this.players[unitId].setLatLng(pos)
    }

    if (!this.positionned) {
      this.map.panTo(pos)
      this.positionned = true
    }
  }

  removePlayer (playerId) {
    if (this.players[playerId] === undefined) {
      return
    }
    const marker = this.players[playerId]
    this.playerLayer.removeLayer(marker)
    delete this.players[playerId]
  }

  displayWalkVerify (x, y) {
    ({ x, y } = transformCoords({ x, y }))
    const unitId = 99999
    const pos = xy(x, y)
    if (this.players[unitId] === undefined) {
      this.players[unitId] = Diablo2Map.addMarker(this.playerLayer, pos, 'red', 'myself', false, sorceressIcon)
    } else {
      this.players[unitId].setLatLng(pos)
    }
    this.map.panTo(pos)
    this.positionned = true
  }

  displayWarp (x, y, unitId) {
    ({ x, y } = transformCoords({ x, y }))
    const pos = xy(x, y)
    if (this.warps[unitId] === undefined) {
      this.warps[unitId] = Diablo2Map.addMarker(this.warpLayer, pos, 'orange', 'warp ' + unitId, false, waypointIcon)
    }
  }

  static createIcon (myCustomColour) {
    return L.AwesomeMarkers.icon({
      markerColor: myCustomColour
    })
  }

  displayItem (x, y, id, name, quality, ground) {
    try {
      if (!ground) {
        return
      }
      ({ x, y } = transformCoords({ x, y }))
      const pos = xy(x, y)
      if (this.items[id] === undefined) {
        if (quality === 'unique') {
          this.items[id] = Diablo2Map.addMarker(this.itemLayer, pos, 'purple', name)
        } else {
          this.items[id] = Diablo2Map.addMarker(this.itemLayer, pos, 'black', name)
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  displayObject (x, y, objectId, objectType) {
    ({ x, y } = transformCoords({ x, y }))
    const pos = xy(x, y)
    if (this.objects[objectId] === undefined) {
      const objectName = objectsById[objectType] === undefined ? 'object ' + objectType : objectsById[objectType]['description - not loaded']
      const lowerName = objectName.toLowerCase()
      let icon = null
      if (lowerName.includes('torch')) {
        icon = torchIcon
      } else if (lowerName.includes('waypoint')) {
        icon = waypointIcon
      }

      this.objects[objectId] = Diablo2Map.addMarker(this.objectLayer, pos, 'cadetblue', objectName + ' ' + objectId, false, icon)
    }
  }

  displayWall (x, y, isWall) {
    ({ x, y } = transformCoords({ x, y }))
    const pos = xy(x, y)
    this.walls.push(Diablo2Map.addMarker(this.wallLayer, pos, 'cadetblue', isWall ? 'wall' : 'ground', false, isWall ? wallIcon : groundIcon))
  }

  displayPath (path) {
    if (this.path !== null) {
      this.path.remove()
    }
    const transformedPath = path.map(transformCoords).map(({ x, y }) => ([y, x]))
    this.path = L.polyline(transformedPath, { color: 'red' }).addTo(this.map)
  }

  getMap () {
    fetch(`127.0.0.1:6666/sessions/${this.sessionId}/areas/${this.areaId}`)
      .then(response => response.json())
      .then(result => {
        for (let key in result.adjacentLevels) {
          let { exits, origin, width, height } = result.adjacentLevels[key]
          let { x, y } = origin
          ({ x, y } = transformCoords({ x, y }))
          const pos = xy(x, y)
          this.exits[key] = Diablo2Map.addMarker(this.warpLayer, pos, 'red', `area ${key}`, false, waypointIcon)
        }
      })
  }

  listenToPackets () {
    this.ws.addEventListener('message', message => {
      const { name, params } = JSON.parse(message.data)

      if (name === 'D2GS_NPCMOVE' || name === 'D2GS_NPCSTOP' || name === 'D2GS_ASSIGNNPC' || name === 'D2GS_NPCMOVETOTARGET') {
        let { x, y, unitId, unitCode } = params
        this.displayNpc(x, y, unitId, unitCode)
      }

      if (name === 'D2GS_PLAYERMOVE') {
        let { targetX: x, targetY: y, unitId } = params
        this.displayPlayerMove(x, y, unitId)
      }

      if (name === 'D2GS_REASSIGNPLAYER') {
        let { x, y, unitId } = params
        if (unitId === 1) { this.displayWalkVerify(x, y) } else { this.displayPlayerMove(x, y, unitId) }
      }

      if (name === 'D2GS_CREATECLIENTPLAYER') {
        let { x, y, guid: unitId, szname } = params
        this.displayPlayerMove(x, y, unitId, Buffer.from(szname).toString().replace(/\0.*$/g, ''))
      }

      if (name === 'D2GS_PLAYERLEFT') {
        let { playerId } = params
        this.removePlayer(playerId)
      }

      /*
      if (name === 'D2GS_WALKVERIFY') {
        let { x, y } = params
        this.displayWalkVerify(x, y)
      }
      */

      if (name === 'D2GS_RUNTOLOCATION' || name === 'D2GS_WALKTOLOCATION') {
        let { x, y } = params
        this.displayWalkVerify(x, y)
      }

      if (name === 'D2GS_ASSIGNLVLWARP') {
        let { x, y, unitId } = params
        this.displayWarp(x, y, unitId)
      }

      if (name === 'D2GS_ITEMACTIONWORLD') {
        let { x, y, id, name, quality, ground } = params
        this.displayItem(x, y, id, name, quality, ground)
      }

      if (name === 'D2GS_WORLDOBJECT') {
        let { x, y, objectId, objectUniqueCode } = params
        this.displayObject(x, y, objectId, objectUniqueCode)
      }

      if (name === 'mapPoint') {
        let { x, y, isWall } = params
        this.displayWall(x, y, isWall)
      }

      if (name === 'path') {
        this.displayPath(params)
      }

      if (name === 'noPath' && this.path !== null) {
        this.path.remove()
        this.path = null
      }

      if (name === 'D2GS_LOADACT') {
        let { act, mapId, areadId } = params
        this.act = act
        this.areaId = areadId
        // curl -X POST -H "Content-Type: application/json" -d "{\"difficulty\": 1, \"mapid\": 1342177280}" 127.0.0.1:6666/sessions/
        let data = {
          'mapId': mapId,
          'difficulty': 1
        }
        fetch('127.0.0.1:6666/sessions/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=utf-8'
          },
          body: JSON.stringify(data)
        }).then(response => response.json())
          .then(result => { this.sessionId = result.id })
          .then(result => this.getMap())
        // curl localhost:6666/sessions/927e300c-5d38-4151-93e2-b95f8c370d78/areas/2
      }

      if (name === 'D2GS_MAPREVEAL') {
        this.areaId = params.areadId
        if (this.sessionId != null) {
          this.getMap()
        }
      }

      if (name === 'D2GS_GAMECONNECTIONTERMINATED') {
        // TODO: should reset state or something like that
      }
    })
  }

  createGrid () {
    const CanvasLayer = L.GridLayer.extend({
      createTile: function (coords) {
        // create a <canvas> element for drawing
        const tile = L.DomUtil.create('canvas', 'leaflet-tile')
        // setup tile width and height according to the options
        const size = this.getTileSize()
        tile.width = size.x
        tile.height = size.y
        // get a canvas context and draw something on it using coords.x, coords.y and coords.z
        const ctx = tile.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, size.x, size.y)
        // return the tile so it can be rendered on screen
        return tile
      }
    })

    const grid = new CanvasLayer({ tileSize: 32, minZoom: -3 })

    return grid
  }

  displayMap () {
    this.npcs = {}
    this.players = {}
    this.warps = {}
    this.items = {}
    this.objects = {}
    this.walls = []
    this.path = null
    this.exits = {}

    const mapElement = this.shadowRoot.querySelector('#map')
    this.playerLayer = L.layerGroup()
    this.npcLayer = L.layerGroup()
    this.itemLayer = L.layerGroup()
    this.objectLayer = L.layerGroup()
    this.warpLayer = L.layerGroup()
    this.wallLayer = L.layerGroup()

    const baseMaps = {
      'grid': this.createGrid()
    }

    const overlayMaps = {
      'player': this.playerLayer,
      'npc': this.npcLayer,
      'item': this.itemLayer,
      'object': this.objectLayer,
      'warp': this.warpLayer,
      'wall': this.wallLayer
    }

    this.map = L.map(mapElement, {
      crs: L.CRS.Simple,
      minZoom: -6,
      maxZoom: 3,
      layers: Object.values(baseMaps).concat(Object.values(overlayMaps))
    })
    L.control.layers(baseMaps, overlayMaps).addTo(this.map)

    this.map.setView([100, 100], 2)
    this.positionned = false

    const searchLayer = L.layerGroup(Object.values(overlayMaps))
    this.map.addControl(new L.Control.Search({
      layer: searchLayer
    }))

    this.listenToPackets()
  }

  updated (props) {
    if (props.get('ws') !== undefined) {
      this.listenToPackets()
    }
  }

  render () {
    return html`
    <style>
      :host {
      width: 100%; height:100%; position: fixed
      }
      
      ${css}
      ${cssMarkers}
      ${cssSearch}
    </style>
    <div id="map" style=" width: 100%; height:100%; position: relative;"></div>
    `
  }
}

customElements.define('diablo2-map', Diablo2Map)
