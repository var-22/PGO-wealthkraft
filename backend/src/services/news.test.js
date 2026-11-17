import assert from "node:assert/strict";
import { test } from "node:test";
import { decode, parseRss, plainFundName } from "./news.js";

test("fund names are reduced to what the press calls them", () => {
  assert.equal(plainFundName("Parag Parikh Flexi Cap Fund - Direct Plan - Growth"), "Parag Parikh Flexi Cap Fund");
  assert.equal(plainFundName("HDFC Nifty 50 Index Fund - Direct Plan - Growth Option"), "HDFC Nifty 50 Index Fund");
  assert.equal(plainFundName("ICICI Prudential Liquid Fund - - Direct Plan - Growth"), "ICICI Prudential Liquid Fund");
  assert.equal(plainFundName("HDFC Mid Cap Fund - Growth Option - Direct Plan"), "HDFC Mid Cap Fund");
  assert.equal(plainFundName("SBI SMALL CAP FUND - Regular Plan - IDCW Payout"), "SBI SMALL CAP FUND");
  assert.equal(plainFundName("Axis Growth Opportunities Fund - Direct Plan - Growth"), "Axis Growth Opportunities Fund");
  assert.equal(plainFundName("Nippon India Growth Fund (G) Direct Plan Growth"), "Nippon India Growth Fund");
});

test("text is cleaned of markup and entities", () => {
  assert.equal(decode("<![CDATA[Sensex &amp; Nifty  rise]]>"), "Sensex & Nifty rise");
  assert.equal(decode("Fund&#39;s NAV &lt;up&gt; &#x20B9;10"), "Fund's NAV <up> ₹10");
});

test("an RSS feed becomes a list of headlines, newest first", () => {
  const xml = `<rss><channel>
    <item><title>Older story - Mint</title><link>https://example.com/a</link><pubDate>Mon, 16 Nov 2026 04:00:00 GMT</pubDate><source url="https://livemint.com">Mint</source></item>
    <item><title><![CDATA[Newer &amp; bigger story - The Hindu]]></title><link>https://example.com/b</link><pubDate>Tue, 17 Nov 2026 04:00:00 GMT</pubDate><source url="x">The Hindu</source></item>
    <item><title>No link</title><link></link></item>
    <item><title>Bad link</title><link>javascript:alert(1)</link></item>
    <item><title>No source given</title><link>https://www.example.org/c</link><pubDate>Sun, 15 Nov 2026 04:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const items = parseRss(xml);
  assert.deepEqual(items.map((i) => i.title), ["Newer & bigger story", "Older story", "No source given"]);
  assert.deepEqual(items.map((i) => i.source), ["The Hindu", "Mint", "example.org"]);
  assert.equal(items[0].publishedAt, "2026-11-17T04:00:00.000Z");
  assert.equal(parseRss(xml, 1).length, 1);
  assert.deepEqual(parseRss("not a feed"), []);
});
