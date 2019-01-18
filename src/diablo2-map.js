/* globals customElements */

import { LitElement, html } from '@polymer/lit-element/'
import L from 'leaflet'
import css from 'leaflet/dist/leaflet.css'
/* This code is needed to properly load the images in the Leaflet CSS */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
})

function transformCoords ({ x, y }) {
  return { x: x - 4400, y: -y + 4700 }
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
    this.entities = {}
    this.displayMap()
  }

  displayMap () {
    const mapElement = this.shadowRoot.querySelector('#map')
    this.map = L.map(mapElement, {
      crs: L.CRS.Simple,
      minZoom: -3
    })

    const bounds = [xy(-25, -26.5), xy(428, 220)]
    L.imageOverlay('assets/Rogue_Encampment_Map.jpg', bounds).addTo(this.map)

    this.map.setView(xy(120, 70), 1)

    this.ws.addEventListener('message', message => {
      const { protocol, name, params } = JSON.parse(message.data)
      console.log(protocol, name, JSON.stringify(params))

      if (name === 'D2GS_NPCMOVE' || name === 'D2GS_NPCSTOP') {
        let { x, y, unitId } = params;
        ({ x, y } = transformCoords({ x, y }))
        if (this.entities[unitId] === undefined) {
          this.entities[unitId] = L.marker(xy(x, y)).addTo(this.map).bindTooltip('NPC ' + unitId, { permanent: true, direction: 'right' })
        } else {
          this.entities[unitId].setLatLng(xy(x, y))
        }
      }

      if (name === 'D2GS_PLAYERMOVE') {
        let { targetX: x, targetY: y, unitId } = params;
        ({ x, y } = transformCoords({ x, y }))
        if (this.entities[unitId] === undefined) {
          this.entities[unitId] = L.marker(xy(x, y)).addTo(this.map).bindTooltip('player ' + unitId, { permanent: true, direction: 'right' })
        } else {
          this.entities[unitId].setLatLng(xy(x, y))
        }
      }

      if (name === 'D2GS_WALKVERIFY') {
        let { x, y } = params;
        ({ x, y } = transformCoords({ x, y }))
        const unitId = 99999
        if (this.entities[unitId] === undefined) {
          this.entities[unitId] = L.marker(xy(x, y)).addTo(this.map).bindTooltip('myself ', { permanent: true, direction: 'right' })
        } else {
          this.entities[unitId].setLatLng(xy(x, y))
        }
      }

      if (name === 'D2GS_ASSIGNLVLWARP') {
        let { x, y, warpId } = params;
        ({ x, y } = transformCoords({ x, y }))
        if (this.entities[warpId] === undefined) {
          this.entities[warpId] = L.marker(xy(x, y)).addTo(this.map).bindTooltip('warp ', { permanent: true, direction: 'right' })
        } else {
          this.entities[warpId].setLatLng(xy(x, y))
        }
      }

      if (name === 'D2GS_ITEMACTIONWORLD') {
        try {
          if (!params.ground) {
            return
          }
          let { x, y, id, name } = params;
          ({ x, y } = transformCoords({ x, y }))
          if (this.entities[id] === undefined) {
            this.entities[id] = L.marker(xy(x, y)).addTo(this.map).bindTooltip(name, { permanent: true, direction: 'right' })
          } else {
            this.entities[id].setLatLng(xy(x, y))
          }
        } catch (error) {
          console.log(error)
        }
      }
    })
  }

  render () {
    return html`
    <style>
      :host {
      width: 100%; height:100%; position: fixed
      }
      
      ${css}
    </style>
    <div id="map" style=" width: 100%; height:100%; position: relative;"></div>
    `
  }
}

customElements.define('diablo2-map', Diablo2Map)
