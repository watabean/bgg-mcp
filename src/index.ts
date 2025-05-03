import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { XMLParser } from "fast-xml-parser";

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
      const bggApiUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${id}&stats=1`;

      // BGG API エンドポイントへ HTTP GET リクエストを送信
      const response = await fetch(bggApiUrl);
      if (!response.ok) {
        throw new Error(`BGG API returned status: ${response.status}`);
      }
      const xmlText = await response.text();

      // fast-xml-parser を使用して XML を JSON に変換
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
      });
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
