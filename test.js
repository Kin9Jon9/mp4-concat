const concat = require('ffmpeg-concat')
const dimensions = require('get-video-width-height');
const fs = require('fs');
const path = require('path');
const fluent = require('fluent-ffmpeg');
const child_process = require('child_process')
const spawn = child_process.spawn;


//영상 사이즈를 가져옵니다.
function getDimensions(file){
  return new Promise((resolve, reject) => {
    dimensions(`./input/${file}`).then(function (dimensions) {
      resolve(`${dimensions.width}x${dimensions.height}`)
    })
  })
}

//ffmpeg 모듈을 직접 호출합니다.
async function resizeProcessing(args) {

	var ffmpeg = spawn('ffmpeg', args);

	let data = "";
  for await (const chunk of ffmpeg.stdout) {
    console.log('stdout chunk: '+chunk);
    data += chunk;
	}
	
  let error = "";
  for await (const chunk of ffmpeg.stderr) {
    console.error('stderr chunk: '+chunk);
    error += chunk;
	}

	ffmpeg.on('close', (code) => {
			console.log(`Processing is END. child process exited with code ` + code);
	});
}


//1920x1080으로 resize 후 저장합니다.
function resize(filename){
  return new Promise((resolve, reject) => {
    const inputPath = `./input/${filename}`;
    const outputPath = `./resize/input/${filename}`

    // const args = [
    //   '-i', 
    //   inputPath, 
    //   '-vf', 
    //   'scale=1920:1080',
    //   '-c:v',
    //   'libx264',
    //   '-crf',
    //   '18',
    //   '-preset',
    //   'veryslow',
    //   '-c:a',
    //   'copy',
    //   outputPath
    // ];

    //resizeProcessing(args);
    var proc = new fluent();

    proc.addInput(inputPath)
    .on('start', function(ffmpegCommand) {
        /// log something maybe
    })
    .on('progress', function(data) {
        /// do stuff with progress data if you want
    })
    .on('end', function() {
      console.log('resize 끝!');
      resolve();
    })
    .on('error', function(error) {
        /// error handling
    })
    .outputOptions([
        '-vf', 
        'scale=1920:1080',
        '-c:v',
        'libx264',
        '-crf',
        '18',
        '-preset',
        'veryslow',
        '-c:a',
        'copy'
      ])
    .output(outputPath)
    .run();
  })
}

//인트로 영상과 동영상을 합칩니다.
async function processing(filename, isResized){
  let inputPath = null;
  let outputPath = null;
  if(isResized === false){
    inputPath = `./input/${filename}`
    outputPath = `./output/${filename}`
  } else {
    inputPath = `./resize/input/${filename}`
    outputPath = `./resize/output/${filename}`
  }

  await concat({
    output: outputPath,
    videos: [
      'intro.mp4',
      inputPath
    ],
    transition: {
      name: 'fade',
      duration: 1
    }
  })
}

//input 폴더에 있는 동영상 목록을 가져옵니다.
function getFileList(){
  return new Promise((resolve, reject)=>{
    fs.readdir(path.join(__dirname, 'input'),(err, fileList)=>{
      if (err) reject(fileList);
      else resolve(fileList);
    })
  })
}

getFileList().then(
  async (result) => {

    const idx = result.indexOf('.DS_Store');
    result.splice(idx, 1);

    for (const index in result){
      const filename = result[index];
      size = await getDimensions(filename);
      //Directly concat
      if (size === '1920x1080'){
        console.log(`intro 규격과 맞는 사이즈 입니다. Size : ${size}`)
        await processing(filename, false);
      //Concat after resize
      } else {
        console.log(`intro 규격과 맞지 않는 사이즈 입니다. Size : ${size}`);
        await resize(filename);
        console.log('파일 크기를 재조정 했습니다.');
        await processing(filename, true);
      }
    }
  }, (error) => {

  }
)

/**
 * 모든 파일을 읽어옴.
 * 1920x1080 파일만 선별해서 우선적으로 병합
 * 그 외의 파일은 격리 (정리 해놓기)
 * 
 * --
 * 모든 파일을 읽어옴
 * 1920x1080이 아닌 파일들을 모두 resize 해줌
 * 모든 파일을 병합함.
 * 
 * --
 * 모든 파일을 읽어옴
 * 1920x1080이 아닌 파일들을 우선적으로 격리
 * 1920X1080인 파일들 병합
 * 1920x1080이 아닌 파일들을 resize 함
 * resize파일들 병합
 * 
 * --
 * 모든 파일을 읽어옴
 * 1920x1080이라면 바로 병합 
 * 1920x1080이 아니라면 resize 후 병합
 */