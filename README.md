# BGG MCP (BoardGameGeek Model Context Protocol) Server

このプロジェクトは、[BoardGameGeek API](https://boardgamegeek.com/wiki/page/BGG_XML_API2)をラップして、[Model Context Protocol (MCP)](https://github.com/microsoft/modelcontextprotocol)を通じてアクセスできるようにするサーバーです。

## 機能

- ボードゲームのキーワード検索
- ボードゲームの詳細情報の取得
- 様々なボードゲーム関連アイテム（拡張、アクセサリー、デザイナーなど）の検索

## インストール

```bash
# リポジトリをクローン
git clone [このリポジトリのURL]
cd bgg-mcp

# 依存関係をインストール
npm install

# ビルド
npm run build
```

## 使用方法

### サーバーの実行

```bash
npm run test
```

これにより、MCP Inspector を使用してサーバーが起動し、ローカルでテストできます。

### ツールとリソース

#### `bgg-search`ツール

ボードゲームを検索するためのツールです。

パラメータ:

- `query` (必須): 検索するキーワード
- `type` (省略可): 検索対象のアイテムタイプ
  - `boardgame` - ボードゲーム
  - `boardgameexpansion` - 拡張パック
  - `boardgameaccessory` - アクセサリー
  - `boardgamedesigner` - デザイナー
  - `rpgitem` - RPG アイテム
  - `videogame` - ビデオゲーム
- `exact` (省略可): 完全一致検索を行うかどうか

#### `bgg-thing`リソース

URI 形式: `bgg://thing/{id}`

ボードゲームの詳細情報を取得するためのリソースです。`id`は BoardGameGeek のゲーム ID です。

## MCP について

Model Context Protocol (MCP)は、大規模言語モデル(LLM)と外部システムを簡単に統合するためのプロトコルです。このプロジェクトでは、MCP を使用して BoardGameGeek の API にアクセスする方法を示しています。

詳細については[MCP 公式リポジトリ](https://github.com/microsoft/modelcontextprotocol)を参照してください。
