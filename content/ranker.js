"use strict";
const REGIONS = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'australia-and-oceania'];

let continent;
const coords = { lat: undefined, lng: undefined };
const COORD_PART_REGEX = "^\\d+(?:\\.\\d+)?$";
const COORD_FULL_REGEX = "^\\d+(?:\\.\\d+)?°\\d+(?:\\.\\d+)?°$";
const params = new URL(location).searchParams;
let showingGeoPicker = false;

const init = () =>
{
    readSearchParams();
    initInputs();

    findSelectedContinent();
};

const initInputs = () =>
{

    const latInput = document.querySelector('#lat');
    const lngInput = document.querySelector('#lng');
    if (coords.lat && coords.lng)
    {
        latInput.value = coords.lat;
        lngInput.value = coords.lng;
    }

    const inputs = document.querySelectorAll('.coord-input');

    for (const input of inputs)
    {
        input.addEventListener('beforeinput', (e) =>
        {
            if (e.data && !(input.value + e.data).match("^\\d+\\.?\\d*$"))
            {
                e.preventDefault();
            }

        });
    }

    const continentButtons = document.querySelectorAll('.continent-picker>li a');

    for (const continentButton of continentButtons)
    {
        const id = continentButton.id;
        continentButton.addEventListener('click', (e) =>
        {
            continent = id;
            document.querySelectorAll('a.selected').forEach((element) => { element.classList.remove('selected'); });
            continentButton.classList.add('selected');
            params.set('continent', continent);
            if (!showingGeoPicker)
            {
                showGeoPicker();
            }
            e.preventDefault();
        });
    }

    const findButton = document.querySelector('#find-button');
    findButton.addEventListener('click', async () =>
    {
        //45.20671480511059°4.834031181350676°
        coords.lat = latInput.value;
        coords.lng = lngInput.value;

        console.log(coords);
        if (coords.lat.toString().match(COORD_PART_REGEX) && coords.lng.toString().match(COORD_PART_REGEX))
        {
            //call API
        }
    });
};

const readSearchParams = () =>
{
    continent = params.get('continent');

    const coordParam = params.get('coords');
    if (coordParam && coordParam.toString().match(COORD_FULL_REGEX))
    {
        const coordSplit = coordParam.split('°');
        coords.lat = coordSplit[0];
        coords.lng = coordSplit[1];
        console.log(coords);
    }
};

const findSelectedContinent = () =>
{
    if (REGIONS.includes(continent))
    {
        document.querySelector(`#${continent}`).classList.add('selected');
        showGeoPicker();
    }
};

const showGeoPicker = () =>
{
    showingGeoPicker = true;
    document.querySelector('#geo-picker').style.display = null;
    document.querySelector('#find-button').style.display = null;
};

init();