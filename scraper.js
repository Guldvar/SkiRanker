"use strict";
const BASE_URL = 'https://www.skiresort.info/ski-resorts/';
const redirectAllowed = process.argv.includes('--redirect');
const slow = process.argv.includes('--slow');
const { rejects } = require('assert');
const { time } = require('console');
const fs = require('fs'), fetch = require('node-fetch'), jsdom = require("jsdom");

const init = async (url) =>
{
    const page = await fetchPage(url).catch(handleError);
    console.log("First page retrieved, starting scrape...");
    let pageCount = 1;
    if (page.window.document.querySelector('#pagebrowser1')) 
    {
        pageCount = page.window.document.querySelector('#pagebrowser1 li:last-child>a').href.split('page/')[1].split('/')[0];
        //<ul id=#pagebrowser1>...<li><a href = 'https://www.skiresort.info/ski-resorts/europe/page/LASTPAGE/'></a></li></ul>
    }
    console.log(pageCount, "pages");
    const resortData = getPageResorts(page);
    for (let i = 2; i <= pageCount; i++)
    {
        console.log("Fetching page", i);
        const page = await fetchPage(`${url}/page/${i}`).catch(handleError);
        try
        {
            resortData.push(...getPageResorts(page));
        }
        catch (e)
        {
            console.error(`Page ${i}: ${e}`);
            continue;
        }
    }
    const fileString = JSON.stringify(resortData, null, "\t");

    fs.writeFile(`./data/${url}.json`, fileString, (res) =>
    {
        console.log(`Completed scrape for '${url}'`);
    });
};

const handleError = (error) =>
{
    console.error(error);
    process.exit(1);
};

const getPageResorts = (page) =>
{
    const resortList = page.window.document.querySelector('#resortList');
    const pageResorts = [];
    for (const resort of resortList.children) 
    {
        const title = resort.querySelector('a.h3');
        if (title.querySelector('span')) 
        {
            title.querySelector('span').remove();
        }
        const name = resort.querySelector('a.h3').innerHTML.trim();
        const heightInfoRaw = resort.querySelector('.info-table tr:nth-child(2) td:last-child');
        if (!heightInfoRaw || heightInfoRaw.children.length < 2) 
        {
            console.log("Failed to find information on", name);
            continue;
        }
        const heightInfo =
        {
            name: name,
            highest: Number(heightInfoRaw.children[1].innerHTML.split(' m')[0]),
            lowest: Number(heightInfoRaw.children[2].innerHTML.split(' m')[0]),
            diff: Number(heightInfoRaw.children[0].innerHTML.split(' m')[0])
        };
        pageResorts.push(heightInfo);
    }
    return pageResorts;
};

const sleep = async (time) =>
{
    return new Promise((resolve) =>
    {
        setTimeout(resolve, time);
    });
};

const fetchPage = (url) =>
{
    return new Promise(async (resolve, reject) =>
    {
        const rawPage = await fetch(BASE_URL + url);
        if (!(rawPage.status == 200 || rawPage.status == 301 && redirectAllowed) || !(rawPage.url.includes(url) || redirectAllowed) || !rawPage.url.includes('ski-resorts')) 
        {
            if (rawPage.status == 429)
            {
                reject("Too many requests, try again later with --slow");
            }
            if (rawPage.status == 404 || !rawPage.url.includes('ski-resorts'))
            {
                reject(`Invalid address: ${url}`);
            }
            if (rawPage.status == 301 || !rawPage.url.includes(url))
            {
                reject('Redirected, try again with --redirect');
            }
            reject(`Failed to fetch: ${url}`);
        }
        if (slow) 
        {
            await sleep(5000);
        }
        resolve(new jsdom.JSDOM(await rawPage.text()));
    });
};

const getURLFromArgs = () =>
{
    for (const arg of process.argv)
    {
        if (arg.startsWith('address='))
        {
            return arg.split('=')[1];
        }
    }
    throw ('Missing argument: address');
};

init(getURLFromArgs());