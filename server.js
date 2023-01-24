"use strict";
const http = require("http");

const fs = require("fs");

const sql = require('sqlite3').verbose();

const fetch = require('node-fetch');

const port = 80;

const ERRORS = {
	400: "Bad Request",
	404: "File Not Found",
	405: "Method Not Allowed",
	500: "Internal Server Error",
	501: "Not Implemented"
};

const REGIONS = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'australia-and-oceania'];
const COLUMNS = ['diff', 'highest', 'lowest', 'name'];
const COORD_FULL_REGEX = "^-?\\d+(?:\\.\\d+)?°-?\\d+(?:\\.\\d+)?°$";


const CONTENT_TYPES = {
	html: { contentType: "text/html", plain: true },
	css: { contentType: "text/css", plain: true },
	js: { contentType: "text/javascript", plain: true },
	json: { contentType: "application/json", plain: true },
	icon: { contentType: "image/x-icon", plain: false },
	svg: { contentType: "image/svg+xml", plain: true },
	png: { contentType: "image/png", plain: false },
};

const loadBingMapsKey = () =>
{
	return fs.readFileSync('data/bingmapskey.txt', 'utf-8');
};
const BING_MAPS_KEY = loadBingMapsKey();

const generateRouteAPIURL = (wp0, wp1) =>
{
	return `http://dev.virtualearth.net/REST/V1/Routes/Driving?o=json&wp.0=${wp0}&wp.1=${wp1}&key=${BING_MAPS_KEY}`;
};

let folderContent = {
	"/index.html": CONTENT_TYPES.html,
	"/ranker": { contentType: CONTENT_TYPES.html.contentType, location: "/ranker.html", plain: true },
	"/main.css": CONTENT_TYPES.css,
	"/index.js": CONTENT_TYPES.js,
	"/ranker.js": CONTENT_TYPES.css,
	"/pin-48.svg": CONTENT_TYPES.svg,
	"/api": { contentType: CONTENT_TYPES.json.contentType, plain: true, generate: true }
	//"/favicon.ico" : contentTypes.icon
};

const findFile = (fullUrl, url, params) =>
{
	if (url == '/')
	{
		return { status: 200, url: "/index.html", contentType: "text/html", plain: true };
	}
	if (url.endsWith('/'))
	{
		return { status: 301, url: url.slice(0, -1), };
	}

	params = getParams(params);
	if (params.coords.lat != undefined && params.coords.lng != undefined && !params.region)
	{
		console.log(getRegion(params.coords));
		return { status: 301, url: `${fullUrl}&region=${getRegion(params.coords)}` };
	}
	for (const key in folderContent)
	{
		if (key == url)
		{
			return { status: 200, url: key, ...folderContent[key], params: params };
		}
	}
	return { status: 404 };
};

const getRegion = (coords) =>
{
	//Northern hemisphere
	if (coords.lat > 0) 
	{
		//Northeastern hemisphere
		if (coords.lng > -20)
		{
			if (coords.lng > 60)
			{
				return 'asia';
			}
			if (coords.lat > 25)
			{
				return 'europe';
			}
			return 'africa';
		}
		//Northwestern hemisphere
		return 'north-america';

	}
	//Southeastern hemisphere
	if (coords.lng > -20)
	{
		if (coords.lng > 70)
		{
			return 'australia-and-oceania';
		}
		return 'africa';
	}
	//Southwestern hemisphere
	return 'south-america';

};

const sendError = (res, code, msg = ERRORS[code]) =>
{
	res.writeHead(code);
	res.write(msg);
	res.end();
};

const getParams = (paramString) =>
{
	const paramsParsed =
	{
		region: undefined,
		coords: { lat: undefined, lng: undefined },
		sortMode: undefined,
		order: undefined
	};
	if (paramString == undefined) return paramsParsed;
	const paramList = paramString.split('&');
	for (const param of paramList)
	{
		if (param.startsWith('region='))
		{
			const regionParam = param.split('=')[1];
			if (REGIONS.includes(regionParam))
			{
				paramsParsed.region = regionParam;
			}
		}
		else if (param.startsWith('coords='))
		{
			const coordsParam = param.split('=')[1].replaceAll('%C2%B0', '°');
			if (coordsParam.match(COORD_FULL_REGEX))
			{
				const coordSplit = coordsParam.split('°');
				paramsParsed.coords.lat = coordSplit[0];
				paramsParsed.coords.lng = coordSplit[1];
			}
		}
		else if (param.startsWith('sort='))
		{
			const sortParam = param.split('=')[1];
			if (COLUMNS.includes(sortParam))
			{
				paramsParsed.sort = sortParam;
			}
		}
		else if (param.startsWith('order='))
		{
			const orderParam = param.split('=')[1];
			if (['ASC', 'DESC'].includes(orderParam))
			{
				paramsParsed.order = orderParam;
			}
		}
	}
	return paramsParsed;
};

const generateJSON = async (params) =>
{

	if (!params.region)
	{
		return JSON.stringify({ error: "Invalid region" });
	}
	if (params.coords.lat == undefined || params.coords.lng == undefined)
	{
		return JSON.stringify({ error: "Invalid coordinates" });
	}
	const sortMode = params.sort ? params.sort : 'diff';
	const order = params.order ? params.order : 'DESC';
	const db = new sql.Database('./data/worldwide.db');
	return new Promise(async (resolve, reject) =>
	{
		const json = await db.asyncAll(`SELECT name, highest, lowest, diff FROM ${params.region.replaceAll('-', '')}  ORDER BY ${sortMode} ${order} LIMIT 20`)
			.catch((e) =>
			{
				console.error(e);
				reject("Something went wrong... maybe the data doesn't exist.");
			});
		db.close();
		const promises = [];
		for (const resort of json)
		{
			promises.push(new Promise(async (resolve) =>
			{
				const getRoute = await (await fetch(generateRouteAPIURL(`${params.coords.lat},${params.coords.lng}`, resort.name))).json();
				if (getRoute.statusCode == 200)
				{
					const driveTimeSecs = getRoute.resourceSets[0].resources[0].travelDuration;
					resort.driveTime = `${Math.round(driveTimeSecs / 3600)}h`;
					resort.fallHeight = parseFloat((resort.diff / (2 * driveTimeSecs / 3600)).toFixed(2));
				}
				resolve();
			}));
		}
		await Promise.all(promises);
		resolve(JSON.stringify(json));
	});
};

const secondsToHms = (d) =>
{
	d = Number(d);
	const h = Math.floor(d / 3600);
	const m = Math.floor(d % 3600 / 60);
	const s = Math.floor(d % 3600 % 60);

	const hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	const mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	const sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return hDisplay + mDisplay + sDisplay;
};

const handleGet = (req, res) =>
{
	const resObj = findFile(req.url, req.url.split('?')[0], req.url.split('?')[1]);
	if (resObj.status == 200)
	{
		if (resObj.location)
		{
			resObj.url = resObj.location;
		}
		if (resObj.generate)
		{
			res.writeHead(200, { 'Content-Type': resObj.contentType });
			generateJSON(resObj.params).then((json) =>
			{
				res.write(json);
				res.end();
			}).catch((e) =>
			{
				res.write(JSON.stringify({ error: e }));
				res.end();
			});

		} else if (resObj.plain)
		{
			fs.readFile("./content" + resObj.url, "utf8", (err, data) =>
			{
				if (err)
				{
					sendError(res, 500);
				} else
				{
					res.writeHead(200, { 'Content-Type': resObj.contentType });
					res.write(data);
					res.end();
				}
			});
		} else
		{
			fs.createReadStream("./content" + resObj.url).pipe(res);
		}
	} else if (resObj.status == 301)
	{
		res.writeHead(301, { location: resObj.url });
		res.end();
	} else if (resObj.status == 404)
	{
		sendError(res, 404);
	} else
	{
		sendError(res, 500, "Unreachable");
	}
};

const server = http.createServer((req, res) =>
{
	console.log(req.url);
	if (req.method == "GET")
	{
		handleGet(req, res);
	} else
	{
		sendError(res, 501);
	}
});

server.listen(port, () =>
{
	console.log(`Server running at port:${port}`);
});

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

