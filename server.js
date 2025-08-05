const express = require('express');
const path = require('path');
const fs = require('fs');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 出力ディレクトリを作成
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/output', express.static(outputDir));

// メインページ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ダウンロードエンドポイント
app.post('/download', async (req, res) => {
    const { url, format } = req.body;

    if (!url || !format) {
        return res.status(400).json({ message: 'URLと形式が必要です' });
    }

    if (!ytdl.validateURL(url)) {
        return res.status(400).json({ message: '無効なYouTube URLです' });
    }

    try {
        console.log(`ダウンロード開始: ${url} (${format})`);
        
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[\\/:"*?<>|]/g, '-');
        const filename = `${title}.${format}`;
        const outputFilePath = path.join(outputDir, filename);

        // 既存ファイルがある場合は削除
        if (fs.existsSync(outputFilePath)) {
            fs.unlinkSync(outputFilePath);
        }

        // ストリーム設定
        const streamOptions = format === 'mp4' 
            ? { quality: 'highestvideo' }
            : { filter: 'audioonly', quality: 'highestaudio' };

        const stream = ytdl(url, streamOptions);

        // ffmpeg設定
        const ffmpegCommand = ffmpeg(stream).toFormat(format);

        // 形式ごとの設定
        switch (format) {
            case 'mp3':
                ffmpegCommand.audioBitrate(128);
                break;
            case 'wav':
                ffmpegCommand.audioCodec('pcm_s16le');
                break;
            case 'm4a':
                ffmpegCommand.audioCodec('aac').audioBitrate(128);
                break;
            case 'aac':
                ffmpegCommand.audioCodec('aac').audioBitrate(128);
                break;
            case 'mp4':
                ffmpegCommand.videoCodec('libx264').audioCodec('aac');
                break;
        }

        // 変換実行
        ffmpegCommand
            .on('end', () => {
                console.log(`変換完了: ${filename}`);
                res.json({
                    success: true,
                    filename: filename,
                    downloadUrl: `/output/${encodeURIComponent(filename)}`
                });
            })
            .on('error', (err) => {
                console.error('変換エラー:', err);
                res.status(500).json({ message: `変換エラー: ${err.message}` });
            })
            .save(outputFilePath);

    } catch (error) {
        console.error('ダウンロードエラー:', error);
        res.status(500).json({ message: `ダウンロードエラー: ${error.message}` });
    }
});

// ファイル一覧取得
app.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync(outputDir)
            .filter(file => !file.startsWith('.'))
            .map(file => {
                const filePath = path.join(outputDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    created: stats.birthtime,
                    downloadUrl: `/output/${encodeURIComponent(file)}`
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json(files);
    } catch (error) {
        res.status(500).json({ message: 'ファイル一覧の取得に失敗しました' });
    }
});

// ファイル削除
app.delete('/files/:filename', (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(outputDir, filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'ファイルを削除しました' });
        } else {
            res.status(404).json({ message: 'ファイルが見つかりません' });
        }
    } catch (error) {
        res.status(500).json({ message: 'ファイルの削除に失敗しました' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
    console.log('YouTube ダウンローダーが使用可能です！');
});
