"use strict";
const BASE_URL = 'https://www.skiresort.info/ski-resorts/';
const redirectAllowed = process.argv.includes('--redirect');
const slow = process.argv.includes('--slow');
const json = process.argv.includes('--json');
const fs = require('fs'), fetch = require('node-fetch'), jsdom = require("jsdom"), sql = require('sqlite3').verbose();

const init = async (url) =>
{
    console.log("Started", url);
    const firstPage = await fetchPage(url).catch(handleError);
    console.log("First page retrieved, starting scrape...");
    let pageCount = 1;
    if (firstPage.window.document.querySelector('#pagebrowser1')) 
    {
        pageCount = firstPage.window.document.querySelector('#pagebrowser1 li:last-child>a').href.split('page/')[1].split('/')[0];
        //<ul id=#pagebrowser1>...<li><a href = 'https://www.skiresort.info/ski-resorts/europe/page/LASTPAGE/'></a></li></ul>
    }
    console.log(pageCount, "pages");
    const resortData = getPageResorts(firstPage);
    resortData.push(...(await getNPages(url, pageCount)));

    const db = json ? undefined : await initAndGetDataBase(url);
    writeToFile(resortData, url, db, () =>
    {
        console.log(`Completed scrape for '${url}'`);
    });
};

const initAndGetDataBase = async (url) =>
{
    const db = new sql.Database(`./data/worldwide.db`);
    const row = await db.asyncGet('SELECT * FROM sqlite_master WHERE type="table" AND name=?', [url]).catch(handleError);
    if (row)
    {
        await db.asyncRun(`DROP TABLE ${url}`).catch(handleError);
    }
    await db.asyncRun(`CREATE TABLE ${url} (rowid INTEGER PRIMARY KEY, name TEXT, highest INTEGER, lowest INTEGER, diff INTEGER)`)
        .catch(handleError);
    return db;
};

sql.Database.prototype.asyncRun = function (query, params)
{
    const db = this;
    return new Promise((resolve, reject) =>
    {
        const cb = function (err)
        {
            if (err)
            {
                reject(err);
            }
            resolve(this);
        };
        db.run(query, params, cb);
    });
};

sql.Database.prototype.asyncGet = function (query, params)
{
    const db = this;
    return new Promise((resolve, reject) =>
    {
        const cb = function (err, res)
        {
            if (err) 
            {
                reject(err);
            }
            resolve(res);
        };
        db.get(query, params, cb);
    });
};

sql.Database.prototype.asyncAll = function (query, params)
{
    const db = this;
    return new Promise((resolve, reject) =>
    {
        const cb = function (err, res)
        {
            if (err) 
            {
                reject(err);
            }
            resolve(res);
        };
        db.all(query, params, cb);
    });
};


const getNPages = async (url, pageCount) =>
{
    const resortData = [];
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
    return resortData;
};

const writeToFile = async (resortData, url, db, cb) =>
{
    console.log("Writing...");
    if (db)
    {
        const promises = [];
        for (const resort of resortData)
        {
            promises.push(db.asyncRun(`INSERT INTO ${url} (name, highest, lowest, diff) VALUES (?, ?, ?, ?)`,
                [resort.name, resort.highest, resort.lowest, resort.diff]));
        }
        await Promise.all(promises);
        cb();
    }
    else
    {
        const fileString = JSON.stringify(resortData, null, "\t");

        fs.writeFile(`./data/${url}.json`, fileString, cb);
    }
};

const handleError = (error) =>
{
    console.trace(error);
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
        let incorrectFormat = undefined;
        for (const key in heightInfo)
        {
            const value = heightInfo[key];
            if (value === null
                || value === undefined
                || (typeof value === 'number' && isNaN(value)))
            {
                incorrectFormat = key;
                break;
            }
        }
        if (incorrectFormat)
        {
            console.log("Found incorrectly formatted information", "'" + incorrectFormat + "'", "on", name);
            continue;
        }
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
        if (!(rawPage.status == 200
            || rawPage.status == 301 && redirectAllowed)
            || !(rawPage.url.includes(url) || redirectAllowed)
            || !rawPage.url.includes('ski-resorts')) 
        {
            if (rawPage.status == 429)
            {
                reject("Too many requests, try again later with --slow");
            }
            if (rawPage.status == 404 || !rawPage.url.includes(BASE_URL))
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