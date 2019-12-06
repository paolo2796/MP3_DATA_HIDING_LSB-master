/*jshint node:true, esversion:6 */
"use strict";

const fs = require("fs");
const util = require("util");
const mp3Parser = require("mp3-parser");

const pathToMp3 = process.argv[2];
const toArrayBuffer = buffer => {
    const bufferLength = buffer.length;
    const uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

    for (let i = 0; i < bufferLength; ++i) { uint8Array[i] = buffer[i]; }
    return uint8Array.buffer;
};

if (!pathToMp3) {
    console.log("please invoke with path to MPEG audio file, i.e. 'node parse.js <file>'");
    process.exit(0);
}
fs.readFile(pathToMp3, (error, buffer) => {
    if (error) {
        console.error("" + error);
        process.exit(1);
    }
    var buf_dataview = new DataView(toArrayBuffer(buffer));
    const tags = mp3Parser.readTags(buf_dataview);
    var dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.nextFrameIndex);
    var count=0;
    while(dataFrame != null && mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
        dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
        if(dataFrame.header.frameIsPadded && dataFrame.header.privateBit==1){
            count++;
            var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
            var b_dataview = new DataView(toArrayBuffer(sliceBuf));
            console.log(b_dataview.getUint8(sliceBuf.length-1));
        }
    }
    console.log(count);

});
