"use strict";
const http = require("http");

const fs = require("fs");

const { renderFile } = require('node-html-templates')(__dirname);

const port = 80;

const ERRORS = {
	400: "Bad Request",
	404: "File Not Found",
	405: "Method Not Allowed",
	500: "Internal Server Error",
	501: "Not Implemented"
};

const REGIONS = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'australia-and-oceania'];

const CONTENT_TYPES = {
	html: { contentType: "text/html", plain: true },
	css: { contentType: "text/css", plain: true },
	js: { contentType: "text/javascript", plain: true },
	json: { contentType: "text/json", plain: true },
	icon: { contentType: "image/x-icon", plain: false },
	svg: { contentType: "image/svg+xml", plain: true },
	png: { contentType: "image/png", plain: false },
};

const templateContent = (ct, templateFile, args) =>
{
	return {
		contentType: ct.contentType,
		plain: true,
		template: true,
		templateFile: templateFile,
		args: args
	};
};

const loadBingMapsKey = () =>
{
	return fs.readFileSync('data/bingmapskey.txt', 'utf-8');
};
const BING_MAPS_KEY = loadBingMapsKey();

let folderContent = {
	"/index.html": CONTENT_TYPES.html,
	"/ranker": templateContent(CONTENT_TYPES.html, "/ranker.html.ejs", {}),
	"/main.css": CONTENT_TYPES.css,
	"/index.js": CONTENT_TYPES.js,
	"/ranker.js": CONTENT_TYPES.css,
	"/pin-48.svg": CONTENT_TYPES.svg,
	"/api": { contentType: CONTENT_TYPES.json.contentType, plain: true, generate: true }
	//"/favicon.ico" : contentTypes.icon
};

const findFile = (url) =>
{
	url = url.split("?")[0];
	if (url == '/')
	{
		return { status: 200, url: "/index.html", contentType: "text/html", plain: true };
	}
	if (url.endsWith('/'))
	{
		return { status: 301, url: url.slice(0, -1) };
	}
	for (const key in folderContent)
	{
		if (key == url)
		{
			return { status: 200, url: key, ...folderContent[key] };
		}
	}
	return { status: 404 };
};

const sendError = (res, code, msg = ERRORS[code]) =>
{
	res.writeHead(code);
	res.write(msg);
	res.end();
};

const generateJSON = (req) =>
{
	const params = req.url.split('?')[1].split('&');
	let region;
	let coords = { lat: undefined, lng: undefined };
	for (const param of params)
	{
		if (param.startsWith('region='))
		{
			const regionParam = param.split('=')[1];
			if (REGIONS.includes(regionParam))
			{
				region = regionParam;
			}
		}
		else if (param.startsWith('coords='))
		{
			const coordsParam = param.split('=')[1].replaceAll('%C2%B0', '°');
			console.log(coordsParam);
			if (coordsParam.match("^\\d+(?:\\.\\d+)?°\\d+(?:\\.\\d+)?°$"))
			{
				const coordSplit = coordsParam.split('°');
				coords.lat = coordSplit[0];
				coords.lng = coordSplit[1];
			}
		}
	}

	if (!region)
	{
		return JSON.stringify({ status: 'error', reason: "Invalid region" });
	}
	if (coords.lat == undefined || coords.lng == undefined)
	{
		return JSON.stringify({ status: 'error', reason: "Invalid coordinates" });
	}

	return "[]";
};

const handleGet = (req, res) =>
{
	const resObj = findFile(req.url);
	if (resObj.status == 200)
	{
		if (resObj.generate)
		{
			res.writeHead(200, { 'Content-Type': resObj.contentType });
			res.write(generateJSON(req));
			res.end();
		}
		if (resObj.template)
		{
			res.writeHead(200, { 'Content-Type': resObj.contentType });
			res.write(renderFile("./content/" + resObj.templateFile, resObj.args));
			res.end();
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