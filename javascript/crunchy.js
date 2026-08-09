// FetchIDs -------------------------------------------------------------------------------------------
// go to catalog and run the script

async function wait(ms) {return new Promise((resolve) => setTimeout(resolve, ms))};

function getCatalogBatch(){
    batch = []
    nodes = document.querySelectorAll('div[data-t="series-card"]');
    nodes.forEach(node=>{
        batch.push({
            listIndex: node.closest('div[role="listitem"]').getAttribute("data-index"),
            node: node,
            id: node.querySelector('a').href.split('/')[5],
        })
    })
    return batch
}

stop = false
output = {}
catalog = []
for (i=0; i<120 && stop != true; i++){
    batch = await getCatalogBatch()
    catalog = [...catalog, ...batch]
    await catalog.toReversed()[0].node.scrollIntoView()
    await wait(1e3)
}
catalog.map(x=>output[x.listIndex] = x)
console.log(`total Keys: ${Object.keys(output).length}`)
csv=Object.values(output).toSorted(x=>x.listIndex).map(x=>`${x.listIndex},${x.id}`).join("\n")
output


//stop = true // to stop
copy(csv)



// FetchSerieInfo ------------------------------------------------------------------------------------
//change endpoint to /export?format=csv
token=""
url_ids="https://docs.google.com/spreadsheets/d/1vU9mGdrEqa308--st4v9j-H8ZcVrDH1ZXl3rdCnGGBE/export?gid=601086096&format=csv"

response = await fetch(url_ids); text = await response.text();

function parseCSVLine(line) {
    const values = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                value += '"';
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (char === "," && !quoted) {
            values.push(value);
            value = "";
        } else {
            value += char;
        }
    }

    values.push(value);

    return values;
}

raw_data=text.split('\r\n').map(parseCSVLine);
data = raw_data.filter(x=>!x[3])

async function wait(ms) {return new Promise((resolve) => setTimeout(resolve, ms))};

async function fetchRawJSON(serieId, token) {
    const url =
        `https://www.crunchyroll.com/content/v2/cms/series/${serieId}` +
        "?preferred_audio_language=es-419&locale=es-419";

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${serieId}`);
    }
    const json = await response.json();
    return json.data[0];
}

function normalizeData(rawJSON) {
    return {
        id: rawJSON.id,
        title: rawJSON.title,
        audios: rawJSON.audio_locales.toSorted().join(","),
        subtitles: rawJSON.subtitle_locales.toSorted().join(","),
        launchYear: rawJSON.series_launch_year,
        seasonCount: rawJSON.season_count,
        mediaCount: rawJSON.media_count,
        keywords: rawJSON.keywords.toSorted().join(","),
        description: rawJSON.description,        
        thumbnail: rawJSON.images.poster_tall[0][0].source
    }
}

async function getSerieData(stop=true) {
    catalog = []
    rawJSONS = []
    for (i = 0; i<10 && stop!=true; i++) {
        rawJSON = await fetchRawJSON(data[i][1], token)
        serieData = normalizeData(rawJSON)

        rawJSONS.push(rawJSON)
        catalog.push(serieData)
        console.log(serieData)
        await wait(1e3)
    }
    csv = catalog.map(Object.values).map(x=>JSON.stringify(x.join(';'))).join('\n')
    return {
        catalog,
        csv,
        rawJSONS,
    }
}


output = await getSerieData(stop=false)

serieData = normalizeData(await fetchRawJSON(data[1][1], token))
Object.values(serieData).join(';')
copy(output.csv)