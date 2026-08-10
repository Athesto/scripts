/**
 * crunchyRollScrapper is  a script which fetchs basic information of the Catalog
 *
 **/
const myCopy = copy; // save reference to windows-copy
const crunchyRollScrapper = {
  help,
  getIds,
  fetchOneSerie,
  fetchAllSeries,
};

// Main Functions

function help() {
  console.log(`
Crunchy Scraper

Comandos:

  crunchyScraper.getIds()
    Obtiene los IDs del catálogo visible.

  crunchyScraper.fetchOneSerie(seriesId, token)
    Obtiene y normaliza una serie.

  crunchyScraper.fetchAllSeries(token, safeBatchSize)
    Procesa todas las series pendientes.

Ejemplos:

  crunchyScraper.token = "TOKEN"

  await crunchyScraper.fetchOneSerie("GYNQZV50Y", token)

  await crunchyScraper.getRawSeries("GYNQZV50Y")
  `);
}

async function getIds(waitTime = 1e3) {
  const outputCatalog = {};
  const maxIterations = 120;
  if (
    !location.href.includes(
      "https://www.crunchyroll.com/es/videos/alphabetical",
    )
  )
    throw new Error("No estamos en el catálogo");

  for (let i = 0; i < maxIterations; i++) {
    const batch = getCatalogBatch();

    batch.forEach((x) => {
      outputCatalog[x.listIndex] = x;
    });
    console.log("Catalog length: ", Object.keys(outputCatalog).length);

    const lastItem = batch.at(-1);
    const lastIndex = lastItem.listIndex;

    lastItem.node.scrollIntoView();

    await wait(waitTime);

    const newBatch = getCatalogBatch();
    const newLastIndex = newBatch.at(-1).listIndex;

    if (newLastIndex === lastIndex) {
      console.log(`End of catalog at index ${lastIndex}`);
      break;
    }
  }

  return outputCatalog;
}

async function fetchOneSerie(seriesId, token) {
  if (!seriesId) throw new Error("No serieId provided");
  if (!token) throw new Error("No token provided");

  let serie = await fetchRawJSON(seriesId, token);
  let normalizedSerie = normalizeData(serie);
  console.log(normalizedSerie);
  return {
    serie,
    normalizedSerie,
  };
}

async function fetchAllSeries(token, safeBatchSize = 3) {
  const csv = await fetchCSV();
  const csv_filtered = csv.data.filter((x) => !x[3]);
  const seriesIds = csv_filtered.map((x) => x[1]);
  const series = [];
  const seriesNormilied = [];
  const seriesValues = [];

  try {
    for (let i = 0; i < seriesIds.length && i < safeBatchSize; i++) {
      const serieId = seriesIds[i];
      const serieData = await fetchOneSerie(serieId, token);
      const normalizedSerie = serieData.normalizedSerie;

      series.push(serieData.serie);
      seriesNormilied.push(normalizedSerie);
      seriesValues.push(Object.values(normalizedSerie).join("\t"));

      await wait(1000);
    }
  } catch (error) {
    console.log(error);
  }

  const seriesValuesCsv = seriesValues.join("\n");
  console.log("output: ", seriesValuesCsv);
  myCopy(seriesValuesCsv);
  return {
    seriesIds,
    series,
    seriesNormilied,
    seriesValues,
    seriesValuesCsv,
  };
}

// Secondary Functions

const audioPriority = {
  "ja-JP": 1,
  "es-419": 2,
  "es-ES": 3,
};

function sortLocales(locales) {
  return locales.toSorted((a, b) => {
    const priorityA = audioPriority[a] ?? 99;
    const priorityB = audioPriority[b] ?? 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.localeCompare(b);
  });
}

function normalizeData(rawJSON) {
  return {
    id: rawJSON.id,
    title: rawJSON.title,
    audios: sortLocales(rawJSON.audio_locales).join(","),
    subtitles: sortLocales(rawJSON.subtitle_locales).join(","),
    launchYear: rawJSON.series_launch_year,
    seasonCount: rawJSON.season_count,
    mediaCount: rawJSON.media_count,
    availability_status: rawJSON.availability_status,
    keywords: rawJSON.keywords.toSorted().join(","),
    description: tsvEscape(rawJSON.description),
    thumbnail: rawJSON.images.poster_tall[0][0].source,
  };
}

async function fetchRawJSON(serieId, token) {
  const url =
    `https://www.crunchyroll.com/content/v2/cms/series/${serieId}` +
    "?preferred_audio_language=es-419&locale=es-419";

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${serieId}`);
  }
  const json = await response.json();
  return json.data[0];
}

function getCatalogBatch() {
  const batch = [];
  const nodes = document.querySelectorAll('div[data-t="series-card"]');

  nodes.forEach((node) => {
    batch.push({
      listIndex: node
        .closest('div[role="listitem"]')
        .getAttribute("data-index"),
      node: node,
      id: node.querySelector("a").href.split("/")[5],
    });
  });
  return batch;
}

async function fetchCSV(gidVersion = "v2") {
  const gid = {
    v1: "601086096",
    v2: "2074698852",
  }[gidVersion];
  if (!gid) throw new Error("Invalid version");

  const url_ids = new URL(
    "https://docs.google.com/spreadsheets/d/1vU9mGdrEqa308--st4v9j-H8ZcVrDH1ZXl3rdCnGGBE/export",
  );
  url_ids.searchParams.set("format", "csv");
  url_ids.searchParams.set("gid", gid);

  const response = await fetch(url_ids);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url_ids}`);
  }
  const text = await response.text();
  const raw_data = text.split("\r\n").map(parseCSVLine);
  const data = raw_data.filter((x) => !x[3]);
  return {
    text,
    data,
    raw_data,
  };
}

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

function tsvEscape(value) {
  const text = String(value ?? "").replaceAll('"', '""');

  if (
    text.includes("\t") ||
    text.includes("\n") ||
    text.includes("\r") ||
    text.includes('"')
  ) {
    return `"${text}"`;
  }

  return text;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Entry Point ========================================================

// // Fetch CSV ----------------------------------
// const output = await fetchCSV("v1");
// myCopy(output.text);

// // getFullCatalog -----------------------------
// const output = await getIds(3e3);
// myCopy(JSON.stringify(output, null, 2));

// // Fetch single Serie -------------------------
// const token = prompt("Token");
// const token = "<YOUR_TOKEN>";
// const serieId = "GT00371668";
// const output = await crunchyRollScrapper.fetchOneSerie(serieId, token);
// myCopy(JSON.stringify(output.normalizedSerie, null, 2));

// // Fetch all Series ----------------------------
// //const token = prompt("Token")
// const token = "<YOUR_TOKEN>";
// const output = await crunchyRollScrapper.fetchAllSeries(token, 3);
// myCopy(output.seriesValuesCsv);
