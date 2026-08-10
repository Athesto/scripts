/**
 * CrunchyRollScrapper
 * ===================
 *
 * DevTools script for extracting basic series information from the
 * Crunchyroll catalog and preparing it for Google Sheets.
 *
 * Run this script from Chrome DevTools on crunchyroll.com.
 *
 * Workflow:
 *   1. getIds()
 *      Runs on the alphabetical catalog and scrolls through the page
 *      until no new series are loaded. Returns the discovered catalog IDs.
 *
 *   2. fetchOneSerie(seriesId, token)
 *      Fetches the raw Crunchyroll JSON for one series and returns both
 *      the original and normalized data.
 *
 *   3. fetchAllSeries(token, safeBatchSize)
 *      Reads the catalog stored in Google Sheets, finds pending series,
 *      fetches their metadata and generates TSV output ready to paste
 *      back into the spreadsheet.
 *
 * Authentication:
 *   A valid Crunchyroll Bearer token is required for series requests.
 *   The token can be provided manually or requested with prompt("Token").
 *
 * Output:
 *   Series are normalized into:
 *     id, title, audios, subtitles, launchYear, seasonCount, mediaCount,
 *     availability_status, keywords, description and thumbnail.
 *
 *   Multiple values such as audios, subtitles and keywords are stored
 *   comma-separated inside their cell.
 *
 *   Spreadsheet output uses TSV:
 *     \t = column separator
 *     \n = row separator
 *
 * Public API:
 *   crunchyRollScrapper.help()
 *   crunchyRollScrapper.getIds(waitTime)
 *   crunchyRollScrapper.fetchOneSerie(seriesId, token)
 *   crunchyRollScrapper.fetchAllSeries(token, safeBatchSize)
 *
 * Quick start:
 *
 *   const token = prompt("Token");
 *
 *   // One series
 *   await crunchyRollScrapper.fetchOneSerie("GYNQZV50Y", token);
 *
 *   // Pending series
 *   await crunchyRollScrapper.fetchAllSeries(token, 200);
 *
 * Notes:
 *   - `myCopy` keeps a reference to the DevTools `copy()` utility so it
 *     remains available after asynchronous operations.
 *   - `maxIterations` in getIds() is a safety limit; normal termination
 *     happens when scrolling no longer loads a new catalog index.
 *   - `safeBatchSize` limits how many series are requested in one run.
 */

const myCopy = copy;

const crunchyRollScrapper = {
  help,
  getIds,
  fetchOneSerie,
  fetchAllSeries,
};

// Main Functions =====================================================

function help() {
  console.log(`
CrunchyRollScrapper

Commands:

  crunchyRollScrapper.getIds(waitTime)
    Gets IDs from the alphabetical catalog.

  crunchyRollScrapper.fetchOneSerie(seriesId, token)
    Fetches and normalizes one series.

  crunchyRollScrapper.fetchAllSeries(token, safeBatchSize)
    Fetches pending series from Google Sheets
    and generates TSV output.

Examples:

  const token = prompt("Token");

  await crunchyRollScrapper.getIds();

  await crunchyRollScrapper.fetchOneSerie( "GYNQZV50Y", token);

  await crunchyRollScrapper.fetchAllSeries( token, 200);
  `);
}

async function getIds(waitTime = 1e3) {
  const outputCatalog = {};
  const maxIterations = 120;

  if (
    !location.href.includes(
      "https://www.crunchyroll.com/es/videos/alphabetical",
    )
  ) {
    throw new Error("No estamos en el catálogo");
  }

  for (let i = 0; i < maxIterations; i++) {
    const batch = getCatalogBatch();

    batch.forEach((item) => {
      outputCatalog[item.listIndex] = item;
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
  if (!seriesId) {
    throw new Error("No seriesId provided");
  }

  if (!token) {
    throw new Error("No token provided");
  }

  const serie = await fetchRawJSON(seriesId, token);

  const normalizedSerie = normalizeData(serie);

  console.log(normalizedSerie);

  return {
    serie,
    normalizedSerie,
  };
}

async function fetchAllSeries(token, safeBatchSize = 3) {
  const csv = await fetchCSV();

  const csvFiltered = csv.data.filter((row) => !row[3]);

  const seriesIds = csvFiltered.map((row) => row[1]);

  const series = [];
  const seriesNormalized = [];
  const seriesValues = [];

  try {
    for (let i = 0; i < seriesIds.length && i < safeBatchSize; i++) {
      const seriesId = seriesIds[i];

      const serieData = await fetchOneSerie(seriesId, token);

      const normalizedSerie = serieData.normalizedSerie;

      series.push(serieData.serie);
      seriesNormalized.push(normalizedSerie);

      seriesValues.push(Object.values(normalizedSerie).join("\t"));

      await wait(1000);
    }
  } catch (error) {
    console.error(error);
  }

  const seriesValuesTsv = seriesValues.join("\n");

  console.log("output:", seriesValuesTsv);

  myCopy(seriesValuesTsv);

  return {
    seriesIds,
    series,
    seriesNormalized,
    seriesValues,
    seriesValuesTsv,
  };
}

// Secondary Functions =================================================

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
    availabilityStatus: rawJSON.availability_status,
    keywords: rawJSON.keywords.toSorted().join(","),
    description: tsvEscape(rawJSON.description),
    thumbnail: rawJSON.images.poster_tall[0][0].source,
  };
}

async function fetchRawJSON(seriesId, token) {
  const url = new URL(`/content/v2/cms/series/${seriesId}`, location.origin);

  url.searchParams.set("preferred_audio_language", "es-419");

  url.searchParams.set("locale", "es-419");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${seriesId}`);
  }

  const json = await response.json();

  return json.data[0];
}

function getCatalogBatch() {
  const batch = [];

  const nodes = document.querySelectorAll('div[data-t="series-card"]');

  nodes.forEach((node) => {
    const listItem = node.closest('div[role="listitem"]');
    const href = node.querySelector("a").href;
    batch.push({
      listIndex: listItem.getAttribute("data-index"),
      node,
      id: href.split("/")[5],
    });
  });

  return batch;
}

async function fetchCSV(gidVersion = "v2") {
  const gid = {
    v1: "601086096",
    v2: "2074698852",
  }[gidVersion];

  if (!gid) {
    throw new Error("Invalid version");
  }

  const urlIds = new URL(
    "https://docs.google.com/spreadsheets/d/1vU9mGdrEqa308--st4v9j-H8ZcVrDH1ZXl3rdCnGGBE/export",
  );

  urlIds.searchParams.set("format", "csv");

  urlIds.searchParams.set("gid", gid);

  const response = await fetch(urlIds);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${urlIds}`);
  }

  const text = await response.text();

  const rawData = text.split("\r\n").map(parseCSVLine);

  const data = rawData.filter((row) => !row[3]);

  return {
    text,
    data,
    rawData,
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

// Entry Point =========================================================

// Fetch CSV -----------------------------------------------------------
// const output = await fetchCSV("v1");
// myCopy(output.text);

// Get full catalog ids ------------------------------------------------
// const output = await getIds(3e3);
// myCopy( JSON.stringify( output, null, 2));

// Fetch single series -------------------------------------------------
// const token = prompt("Token");
// const token = "eyJhbGciOi..."
// const seriesId = "GT00371668";
// const output = await crunchyRollScrapper .fetchOneSerie( seriesId, token);
// myCopy( JSON.stringify( output.normalizedSerie, null, 2));

// Fetch all series ----------------------------------------------------
// const token = prompt("Token");
// const token = "eyJhbGciOi..."
// const output = await crunchyRollScrapper .fetchAllSeries( token, 3);
// myCopy( output.seriesValuesTsv);
