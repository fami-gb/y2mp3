const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const readline = require('readline');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('YouTube動画のURLを入力してください: ', (url) => {
    if (!ytdl.validateURL(url)) {
        console.error('無効なYouTube URLです。');
        rl.close();
        return;
    }

    rl.question('保存形式を選択してください (mp3/wav/m4a/aac/mp4): ', (format) => {
        const validFormats = ['mp3', 'wav', 'm4a', 'aac', 'mp4'];
        const selectedFormat = format.toLowerCase();

        if (!validFormats.includes(selectedFormat)) {
            console.error('無効な形式です。mp3, wav, m4a, aac, mp4 から選択してください。');
            rl.close();
            return;
        }

        downloadAndConvert(url, selectedFormat);
    });
});

async function downloadAndConvert(videoUrl, format) {
    console.log('動画情報を取得中...');
    try {
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title.replace(/[\\/:"*?<>|]/g, '-');
        const outputFilePath = path.join(outputDir, `${title}.${format}`);

        console.log(`タイトル: ${title}`);
        console.log(`形式: ${format.toUpperCase()}`);
        console.log('ダウンロード開始...');

        // MP4の場合は動画+音声、それ以外は音声のみ
        const streamOptions = format === 'mp4' 
            ? { quality: 'highestvideo' }
            : { filter: 'audioonly', quality: 'highestaudio' };

        const stream = ytdl(videoUrl, streamOptions);

        const ffmpegCommand = ffmpeg(stream)
            .toFormat(format);

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

        ffmpegCommand
            .on('progress', (progress) => {
                process.stdout.write(`\r変換中: ${Math.floor(progress.percent || 0)}%`);
            })
            .on('end', () => {
                console.log('\n変換完了！');
                console.log(`保存先: ${outputFilePath}`);
                rl.close();
            })
            .on('error', (err) => {
                console.error('\nエラー:', err.message);
                rl.close();
            })
            .save(outputFilePath);

    } catch (error) {
        console.error('動画情報の取得に失敗:', error.message);
        rl.close();
    }
}
