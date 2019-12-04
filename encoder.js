/*jshint node:true, esversion:6 */
"use strict";


const fs = require("fs");
const util = require("util");
const mp3Parser = require("mp3-parser");
const bitwise = require("bitwise");
var bw = require ("buffered-writer");



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
    var sliceBuf = buffer.slice(0,tags[tags.length-1]._section.nextFrameIndex);
    var newBuffer = Buffer.concat([sliceBuf]);
    var dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.nextFrameIndex);
    var count=0;
    var count1=0;
    while(dataFrame != null && mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
        count1++;
        if(dataFrame.header.frameIsPadded){
            count++;
            var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
            var arr = [newBuffer,sliceBuf];
            newBuffer = Buffer.concat(arr);
        }
        else{

            var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex-1);
            var byte_padded = Buffer.from("a");
            var arr = [newBuffer,sliceBuf,byte_padded];
            newBuffer = Buffer.concat(arr);
        }

        dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
    }

    console.log("TOT FRAME " + count1 );
    console.log("TOT FRAME UNPADDED " + count);

    // open the file in writing mode, adding a callback function where we do the actual writing
    fs.open(pathToMp3, 'w', function(err, fd) {
        if (err) {
            throw 'could not open file: ' + err;
        }
        fs.write(fd, newBuffer, 0, newBuffer.byteLength, 0, function(err) {
            if (err) throw 'error writing file: ' + err;
            fs.close(fd, function() {
                console.log('wrote the file successfully');
            });
        });

    });

});


function substituteLSB(dataFrame, buffer) {

    for (var i = dataFrame._section.offset + dataFrame.header._section.byteLength; i < dataFrame._section.nextFrameIndex ; i=i+2) {
        var value = buffer.getInt16(i);
        // hack avoid underflow
        if (value == -128)
            value = -127;

            var binaryStr = formatDecToBinary(value);
            var array = Array.from(binaryStr);
            array[array.length - 1] = Math.floor(Math.random() * (2 - 0));
            var binaryStr_altered = array.join("");
            var parsed_value = parseInt(binaryStr_altered, 2);
            buffer.setInt16(i, parsed_value);
    }

}

function paddingStuff(dataFrame, buffer) {

    var value = buffer.getInt8(dataFrame._section.nextFrameIndex-1);
    //console.log(value);

    // hack avoid underflow
        if (value == -128)
            value = -127;

}


function formatDecToBinary(value){
    var binaryStr = null;
    if(value>=0){
        binaryStr = value.toString(2);
        while(binaryStr.length < 15) {
            binaryStr = "0" + binaryStr;
        }
    }
    else{
        binaryStr = value.toString(2);
        binaryStr = binaryStr.substring(1);
        while(binaryStr.length < 15) {
            binaryStr = "0" + binaryStr;
        }
        binaryStr = "-" + binaryStr;
    }


    return binaryStr;

}


