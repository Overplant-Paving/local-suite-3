/* tests/interactions/convert.mjs — Unit & Kitchen Converter (offline, Batch A)
   Exercises: category tabs, generic conversions with known values (2 US cups → mL,
   350 °F → °C), the ingredient (density) converter, and the recipe scaler at ×2
   and a custom ×1.5. Logs expected vs actual observed values. */

export const selectors = [
  "body", ".wrap", ".topbar", ".theme-btn", ".pill", ".pill.on",
  "#genCard", "#genValue", "#genUnit", ".res", ".res b", "footer",
];

export const screenshotAfterInteract = true;

/* read the generic/cooking result grid into {unitLabel: value} */
async function readResults(page, containerSel) {
  return page.$$eval(containerSel + " .res", els =>
    Object.fromEntries(els.map(el => [
      el.querySelector("span").textContent,
      el.querySelector("b").textContent,
    ])));
}

export async function interact({ page, log }) {
  /* --- default tab: Length, 1 km (first unit in the list) --- */
  let res = await readResults(page, "#genResults");
  log(`Length tab default: 1 km -> ft expected 3,280.84, actual ${res["ft"]}; in expected 39,370.08, actual ${res["in"]}`);

  /* --- Volume: 2 US cups -> mL / liter --- */
  await page.getByRole("button", { name: "Volume", exact: true }).click();
  await page.selectOption("#genUnit", "US cup");
  await page.fill("#genValue", "2");
  res = await readResults(page, "#genResults");
  log(`Volume: 2 US cup -> mL expected 473.17647 (473.1764730), actual ${res["mL"]}`);
  log(`Volume: 2 US cup -> liter expected 0.47318, actual ${res["liter"]}`);
  log(`Volume: 2 US cup -> tablespoon expected 32, actual ${res["tablespoon"]}`);

  /* --- Temperature: 350 F -> C / K --- */
  await page.getByRole("button", { name: "Temperature", exact: true }).click();
  await page.selectOption("#genUnit", "°F");
  await page.fill("#genValue", "350");
  res = await readResults(page, "#genResults");
  log(`Temperature: 350 °F -> °C expected 176.66667, actual ${res["°C"]}`);
  log(`Temperature: 350 °F -> K expected 449.81667, actual ${res["K"]}`);

  /* --- Weight: unicode-fraction input "1 ½" pound -> g --- */
  await page.getByRole("button", { name: "Weight", exact: true }).click();
  await page.selectOption("#genUnit", "pound");
  await page.fill("#genValue", "1 ½");
  res = await readResults(page, "#genResults");
  log(`Weight: "1 ½" pound -> g expected 680.38856 (680.3885550), actual ${res["g"]}; oz expected 24, actual ${res["ounce"]}`);

  /* --- Fuel economy: 30 mpg (US) -> L/100km --- */
  await page.getByRole("button", { name: "Fuel economy", exact: true }).click();
  await page.selectOption("#genUnit", "mpg (US)");
  await page.fill("#genValue", "30");
  res = await readResults(page, "#genResults");
  log(`Fuel economy: 30 mpg (US) -> L/100km expected 7.84049 (7.8404861), actual ${res["L/100km"]}`);

  /* --- Cooking: 2 cups all-purpose flour -> g (density 0.53) --- */
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  const cookHidden = await page.$eval("#cookCard", el => el.hidden);
  log(`Cooking tab: cookCard hidden=${cookHidden}, genCard hidden=${await page.$eval("#genCard", el => el.hidden)}`);
  await page.fill("#cookValue", "2");
  await page.selectOption("#cookUnit", "cup");
  await page.selectOption("#cookIng", "All-purpose flour");
  res = await readResults(page, "#cookResults");
  log(`Cooking: 2 cup all-purpose flour -> g expected 250.78 (2*236.5882365*0.53=250.7835307), actual ${res["g"]}`);
  log(`Cooking: same -> oz expected 8.84613, actual ${res["oz"]}; cups round-trip expected 2, actual ${res["cups"]}`);
  log(`Density line: "${await page.textContent("#cookDensity")}" (expected 0.53 g/mL, 1 cup ≈ 125 g)`);

  /* --- Cooking reverse: 250 g granulated sugar -> cups (density 0.85) --- */
  await page.fill("#cookValue", "250");
  await page.selectOption("#cookUnit", "g");
  await page.selectOption("#cookIng", "Granulated sugar");
  res = await readResults(page, "#cookResults");
  log(`Cooking: 250 g granulated sugar -> cups expected 1.24316 (250/(0.85*236.5882365)=1.2431625), actual ${res["cups"]}`);

  /* --- Recipe scaler: default recipe at x2 --- */
  await page.getByRole("button", { name: "Recipe scaler", exact: true }).click();
  const inText = await page.inputValue("#recipeIn");
  log(`Recipe input (default): ${JSON.stringify(inText)}`);
  await page.getByRole("button", { name: "× 2", exact: true }).click();
  let outText = await page.inputValue("#recipeOut");
  log(`Recipe x2 output: ${JSON.stringify(outText)}`);
  log(`  expected line-by-line: "4 cups all-purpose flour" / "3 tsp baking powder" / ` +
      `"1 1/2 cup sugar" / "6 large eggs" / "1 tsp salt" / "2 cup milk"`);

  /* --- Recipe scaler: custom x1.5 --- */
  await page.fill("#customScale", "1.5");
  outText = await page.inputValue("#recipeOut");
  log(`Recipe custom x1.5 output: ${JSON.stringify(outText)}`);
  log(`  expected first line "3 cups all-purpose flour"; "¾ cup sugar" -> "1 1/8 cup sugar"; ` +
      `sbtn highlights cleared=${await page.$$eval(".sbtn.on", els => els.length === 0)}`);

  /* --- x ½ button --- */
  await page.getByRole("button", { name: "× ½", exact: true }).click();
  outText = await page.inputValue("#recipeOut");
  log(`Recipe x0.5 first lines: ${JSON.stringify(outText.split("\n").slice(0, 3))}` +
      ` (expected "1 cups all-purpose flour", "3/4 tsp baking powder", "3/8 cup sugar")`);

  /* leave the tool on the Recipe scaler tab for the post-interaction screenshot */
}
