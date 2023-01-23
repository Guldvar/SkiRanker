"use strict";
const initMap = () =>
{
    try
    {
        const map = L.map('map').setView([51.505, -0.09], 3);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        map.on('click', onMapClick);
    }
    catch (e)
    {
        document.querySelector('#map').innerText = "Failed to load map";
    }
};

const onMapClick = (e) =>
{
    const coords = e.latlng;
    window.location.href = `/ranker?coords=${coords.lat}°${coords.lng}°`;
};

initMap();