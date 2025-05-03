import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const BGG_API_ROOT = "https://boardgamegeek.com/xmlapi2";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const server = new McpServer({
  name: "BGG API Explorer Server", // サーバーの名前
  version: "1.0.0", // サーバーのバージョン
});

// BGG API の Thing コマンドに対応する MCP Resource を定義
// 例: bgg://thing/{id} の形式でリソースにアクセスすることを想定
// {id} は BGG の Thing ID (ゲーム、拡張、アクセサリなど)
server.resource(
  "bgg-thing", // MCP Resource の名前
  new ResourceTemplate("bgg://thing/{id}", { list: undefined }), // Resource の URI パターン
  async (uri, { id }) => {
    // Resource が呼び出されたときのハンドラー関数
    console.log(`Received request for BGG Thing ID: ${id}`);

    try {
      // 資料 に記載されている BGG API のルートパスと Thing コマンドのベース URI を使用して URL を構築
      // 例として stats=1 パラメータを追加し、評価/ランキング情報も取得
      const bggApiUrl = `${BGG_API_ROOT}/thing?id=${id}&stats=1`;

      // BGG API エンドポイントへ HTTP GET リクエストを送信
      const response = await fetch(bggApiUrl);
      if (!response.ok) {
        throw new Error(`BGG API returned status: ${response.status}`);
      }
      const xmlText = await response.text();

      const result = parser.parse(xmlText);

      // パースしたデータから必要な情報を抽出 (例: ゲーム名、平均評価など)
      const gameData = result.items.item; // XML 構造による
      const name = gameData.name?._ || gameData.name?._; // 主な名前を取得
      const averageRating = gameData.statistics.ratings.average?._;

      // 抽出したデータを MCP Resource のレスポンス形式に合わせて整形
      // MCP Resource は typically text コンテンツを返します
      const exampleGameName = `サンプルゲーム (ID: ${id})`; // 実際にはパース結果から取得
      const exampleAverageRating = "N/A"; // 実際にはパース結果から取得

      const contentText = `Game: ${exampleGameName}\nAverage Rating: ${exampleAverageRating}\n(詳細情報は省略)`;

      return {
        contents: [
          {
            uri: uri.href,
            text: contentText, // テキスト形式のコンテンツを返す
          },
        ],
      };
    } catch (error) {
      console.error(`Error processing BGG Thing ID ${id}:`, error);
      // エラーが発生した場合は、エラー情報を含むレスポンスを返す
      return {
        contents: [],
        isError: true,
        errorMessage: `Failed to retrieve BGG data for ID ${id}: ${error}`,
      };
    }
  }
);

server.tool(
  "bgg-search", // ツールの名前
  {
    // ツールの引数スキーマ (ソース[i, 15]より)
    query: z.string().describe("検索するキーワード"),
    type: z
      .enum([
        "rpgitem",
        "videogame",
        "boardgame",
        "boardgameexpansion",
        "boardgameaccessory",
        "boardgamedesigner",
      ])
      .optional()
      .describe("検索対象のアイテムタイプ (省略可、複数指定はコンマ区切り)"),
    exact: z.boolean().optional().describe("完全一致検索を行うか (省略可)"),
  },
  async ({ query, type, exact }) => {
    // ツールのハンドラー関数
    try {
      // BGG APIへのリクエストURLを構築 (ソース[i, 3, 15]より)
      let url = `${BGG_API_ROOT}/search?query=${encodeURIComponent(query)}`;
      if (type) {
        // タイプはカンマ区切りで渡す仕様 (ソース[i, 15]より)
        url += `&type=${encodeURIComponent(type)}`;
      }
      if (exact) {
        url += `&exact=1`; // exact=1の場合のみパラメータをつける (ソース[i, 15]より)
      }

      console.log(`Calling BGG Search API: ${url}`); // デバッグ出力

      // BGG APIを呼び出す (ソース[j, 26]のfetch-weatherツールを参考に、外部API呼び出し)
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const xmlText = await response.text();

      // ここでXMLを解析し、結果を整形するロジックが入る
      // (この部分はSDKの資料には直接記述がないため、BGG XML API2の出力形式に基づいて別途実装が必要です)
      // 例: XMLパーサーライブラリを使用してアイテムリストを抽出

      // 仮の応答データ（実際にはXML解析結果）
      // fast-xml-parser を使用して XML を JSON に変換

      const searchResults = parser.parse(xmlText); // 簡単のためXMLそのままを返す例

      // ツールからの応答形式 (ソース[j, 23, 26]より)
      return {
        content: [
          {
            type: "text",
            text: `BGG Search Results for "${query}":\n\n${searchResults}`,
            // 実際にはここで解析したリストを表示するなど、整形された結果を返すべきです
          },
        ],
      };
    } catch (error: any) {
      console.error("Error calling BGG Search API:", error);
      // エラー応答の形式 (ソース[j, 32]のSQLite Explorerツールを参考に、エラーフラグ付き)
      return {
        content: [
          {
            type: "text",
            text: `Error performing BGG search: ${error.message}`,
          },
        ],
        isError: true, // エラーが発生したことを示すフラグ
      };
    }
  }
);
