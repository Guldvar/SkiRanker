"use strict";
const REGIONS = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'australia-and-oceania'];
const SORT_MODES = ['highest', 'lowest', 'diff'];

let region;
const coords = { lat: undefined, lng: undefined };
const COORD_PART_REGEX = "^-?\\d+(?:\\.\\d+)?$";
const COORD_FULL_REGEX = "^-?\\d+(?:\\.\\d+)?°-?\\d+(?:\\.\\d+)?°$";
const windowURL = new URL(location);
const params = windowURL.searchParams;
let showingGeoPicker = false;
let mapOpen = false;

const init = () =>
{
    readSearchParams();
    initInputs();

    findSelectedRegion();
};

const initInputs = () =>
{


    if (coords.lat && coords.lng)
    {
        setCoordInputCoords(coords);
    }

    const inputs = document.querySelectorAll('.coord-input');

    for (const input of inputs)
    {
        input.addEventListener('beforeinput', (e) =>
        {
            if (e.data && !(input.value + e.data).match("^-?\\d*\\.?\\d*$"))
            {
                e.preventDefault();
            }

        });
    }

    const regionButtons = document.querySelectorAll('.region-picker>li a');

    for (const regionButton of regionButtons)
    {
        const id = regionButton.id;
        regionButton.addEventListener('click', (e) =>
        {
            region = id;
            document.querySelectorAll('a.selected').forEach((element) => { element.classList.remove('selected'); });
            regionButton.classList.add('selected');
            params.set('region', region);
            window.history.pushState('', '', windowURL);
            if (!showingGeoPicker)
            {
                showGeoPicker();
            }
            e.preventDefault();
        });
    }

    const latInput = document.querySelector('#lat');
    const lngInput = document.querySelector('#lng');

    const findButton = document.querySelector('#find-button');
    const sortInput = document.querySelector('#sort-input');
    const orderInput = document.querySelector('#order-input');
    findButton.addEventListener('click', async () =>
    {
        //45.20671480511059°4.834031181350676°
        coords.lat = latInput.value;
        coords.lng = lngInput.value;
        const sort = SORT_MODES.includes(sortInput.value) ? sortInput.value : 'diff';
        const order = ['ASC', 'DESC'].includes(orderInput.value) ? orderInput.value : 'DESC';
        if (region && coords.lat.toString().match(COORD_PART_REGEX) && coords.lng.toString().match(COORD_PART_REGEX))
        {
            const response = await (await fetch(`./api?coords=${coords.lat}°${coords.lng}°&region=${region}&sort=${sort}&order=${order}`)).json();
            if (response.error)
            {
                alert(response.error);
            }
            console.log(response);
            showTable(response);

        }
    });

    const map = initMap();
    const mapOpen = document.querySelector('#map-open');
    mapOpen.addEventListener('click', () => { handleMapOpen(map); });
};

const readSearchParams = () =>
{
    region = params.get('region');

    const coordParam = params.get('coords');
    if (coordParam && coordParam.toString().match(COORD_FULL_REGEX))
    {
        const coordSplit = coordParam.split('°');
        coords.lat = Number(coordSplit[0]);
        coords.lng = Number(coordSplit[1]);
        console.log(coords);
    }
};

const findSelectedRegion = () =>
{
    if (REGIONS.includes(region))
    {
        document.querySelector(`#${region}`).classList.add('selected');
        showGeoPicker();
    }
};

const showGeoPicker = () =>
{
    showingGeoPicker = true;
    document.querySelector('#geo-picker').style.display = null;
    document.querySelector('#options').style.display = null;
};

const initMap = () =>
{
    try
    {
        const map = L.map('map').setView([51.505, -0.09], 3);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        map.on('click', onMapClick);
        map.marker = L.marker([coords.lat ? coords.lat : 0, coords.lng ? coords.lng : 0]);
        if (coords.lat) 
        {
            map.marker.addTo(map);
            map.markerAdded = true;
        }
        return map;
    }
    catch (e)
    {
        document.querySelector('#map').innerText = "Failed to load map";
        document.querySelector('#map').style.display = null;
    }
};

const handleMapOpen = (map) =>
{
    mapOpen = !mapOpen;
    document.querySelector('#map').style.display = mapOpen ? null : 'none';
    if (map)
    {
        map.invalidateSize();
    }

};

const setCoordInputCoords = (coords) =>
{
    document.querySelector('#lat').value = coords.lat;
    document.querySelector('#lng').value = coords.lng;
};

const onMapClick = (e) =>
{

    coords.lat = e.latlng.lat;
    coords.lng = e.latlng.lng;
    setCoordInputCoords(coords);
    params.set('coords', `${coords.lat}°${coords.lng}°`);
    window.history.pushState('', '', windowURL);
    e.target.marker.setLatLng([coords.lat, coords.lng]);
    if (!e.target.markerAdded)
    {
        e.target.marker.addTo(e.target);
    }
};

const showTable = (responseList) =>
{
    if (document.querySelector('#resort-table'))
    {
        document.querySelector('#resort-table').remove();
    }
    const table = document.createElement('table');
    table.classList.add('resort-table');
    table.id = "resort-table";
    table.innerHTML = `
    <tr>
        <th>Name</th>
        <th>Highest elevation [m]</th>
        <th>Lowest elevation [m]</th>
        <th>Fall height [m]</th>
        <th>Travel time</th>
        <th>Fall height per travel hour [m/h]</th>
    </tr>`;
    for (const row of responseList)
    {
        const tr = document.createElement('tr');
        for (const key in row)
        {
            const td = document.createElement('td');
            td.innerText = row[key];
            tr.append(td);
        }
        table.append(tr);
    }
    document.body.append(table);
};

init();