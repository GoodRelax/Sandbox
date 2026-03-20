これまでの手順（インストールから `tsconfig.json` の設定まで）をまとめた Markdown です。
備忘録として保存したり、Qiita や Zenn などの記事の下書きとして使ってください。

````markdown
# Windows で始める TypeScript 環境構築（Winget 編）

Windows Package Manager (`winget`) を使用して、コマンドライン中心に TypeScript 開発環境を構築する手順のログです。

## 1. ツールのインストール

コマンドプロンプト（または PowerShell）を**「管理者として実行」**し、以下のコマンドを実行します。

```cmd
:: 1. Node.js (LTS版) と VS Code をインストール
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Microsoft.VisualStudioCode

:: 2. ターミナルを再起動（環境変数を反映させるため一度閉じて開き直す）

:: 3. TypeScriptコンパイラをグローバルインストール
npm install -g typescript

:: 4. バージョン確認
node -v
code --version
tsc --version
```
````

## 2\. PowerShell の実行権限エラー対策

`tsc` コマンド実行時に「デジタル署名されていません」等のエラーが出る場合の対処法です。
VS Code のターミナル（PowerShell）で以下を実行します。

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
# "Y" を入力してEnter
```

## 3\. プロジェクトの作成と Hello World

作業用フォルダを作成し、VS Code で開きます。

```cmd
mkdir ts-demo
cd ts-demo
code .
```

### ソースコード作成 (`index.ts`)

```typescript
const message: string = "Hello, TypeScript from Windows!";
console.log(message);
```

### コンパイルと実行（手動）

```cmd
:: TSファイルをJSに変換
tsc index.ts

:: 生成されたJSを実行
node index.js
```

## 4\. 本格的なプロジェクト設定 (`tsconfig.json`)

毎回ファイル名を指定せずにコンパイルできるように設定ファイルを作成します。

```cmd
:: 初期設定ファイル (tsconfig.json) の生成
tsc --init
```

### 便利なコンパイルコマンド

`tsconfig.json` がある状態で使用可能です。

- **一括コンパイル:**
  ```cmd
  tsc
  ```
- **自動監視モード（保存するたびに自動変換）:**
  ```cmd
  tsc -w
  ```

<!-- end list -->

```

```

はい、承知しました。
ブラウザでの実行環境の構築、`tsconfig.json` の修正、そして HTML への埋め込みまでの手順をまとめた Markdown です。

既存のノート（手順 4 まで）の続きとして貼り付けて使ってください。

````markdown
## 5. ブラウザでの実行設定 (HTML 作成)

コンパイルされた JavaScript をブラウザで動かすための HTML ファイルを作成します。

**ファイル名:** `index.html` (プロジェクトルートに作成)

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>TS Demo</title>
  </head>
  <body>
    <h1>TypeScript Test</h1>
    <script src="./index.js"></script>
  </body>
</html>
```
````

## 6\. ブラウザ向け設定への修正 (`tsconfig.json`)

`tsc --init` の初期設定は Node.js (サーバー) 向けになっていることが多く、そのままブラウザで動かすと `exports is not defined` エラーが出ます。以下の通り書き換えます。

**修正後の `tsconfig.json` (主要部分)**

```json
{
  "compilerOptions": {
    /* ブラウザ・最新標準向けの重要設定 */
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",

    /* "moduleDetection": "force" がある場合は削除するかコメントアウト */
    // "moduleDetection": "force",

    /* 基本設定 */
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    /* 出力設定 */
    "sourceMap": true,
    "declaration": true
  }
}
```

## 7\. DOM 操作の実装

ブラウザの画面上の文字を TypeScript から操作してみます。

**ソースコード (`index.ts`) の変更**

```typescript
const message: string = "Hello, TypeScript from Windows! (Browser Ver.)";

// 画面（bodyタグ内）を書き換える
document.body.innerHTML = `<h1>${message}</h1>`;
```

**実行手順:**

1.  ターミナルで `tsc` を実行（コンパイル）。
2.  `index.html` をブラウザで開く（またはリロード）。

## 8\. HTML ファイル 1 つにまとめる方法（インライン化）

JS ファイルを別にせず、HTML ファイル単体で配布・実行したい場合の手順です。

1.  `tsc` でコンパイルを実行する。
2.  生成された `index.js` の中身を全行コピーする。
3.  `index.html` の `<script>` タグの中に貼り付ける。

<!-- end list -->

```html
<body>
  <h1>TypeScript Test</h1>

  <script>
    "use strict";
    const message = "Hello, TypeScript from Windows! (Browser Ver.)";
    document.body.innerHTML = `<h1>${message}</h1>`;
  </script>
</body>
```

```

```
