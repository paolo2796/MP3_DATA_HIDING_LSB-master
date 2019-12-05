"use strict";
//imports
const fs = require("fs");
const util = require("util");
const mp3Parser = require("mp3-parser");
const bitwise = require("bitwise");
const bw = require ("buffered-writer");



const pathMp3Stego = "audio_stego.mp3";
const pathToMp3 = process.argv[2];
var secret_message = process.argv[3];

var newBuffer;
var totframes=0;
var totframes_unpadded=0;



if (!pathToMp3) {
    console.log("please invoke with path to MPEG audio file, i.e. 'node parse.js <file>'");
    process.exit(0);
}

const toArrayBuffer = buffer => {
    const bufferLength = buffer.length;
    const uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

    for (let i = 0; i < bufferLength; ++i) { uint8Array[i] = buffer[i]; }
    return uint8Array.buffer;
};

fs.readFile(pathToMp3, (error, buffer) => {
    if (error) {
        console.error("" + error);
        process.exit(1);
    }
    var buf_dataview = new DataView(toArrayBuffer(buffer));
    const tags = mp3Parser.readTags(buf_dataview);
    var sliceBuf = buffer.slice(0,tags[tags.length-1]._section.nextFrameIndex);
    newBuffer = Buffer.concat([sliceBuf]);
    var dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.nextFrameIndex);

    if(!check_max_size_embed_byte(dataFrame,secret_message,buf_dataview)){
        console.warn("Il messaggio è troppo grande per essere iniettato nel file audio corrente");
        console.warn("TOT FRAME " + totframes );
        console.warn("TOT FRAME UNPADDED " + totframes_unpadded);
        process.exit(1);
    }

    console.log("TOT FRAME " + totframes );
    console.log("TOT FRAME UNPADDED " + totframes_unpadded);
    var secret_message_arr = Array.from(secret_message);
    var i=0;
    while(dataFrame!=null && mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
        if(dataFrame.header.frameIsPadded) {
            var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
            var arr = [newBuffer,sliceBuf];
            newBuffer = Buffer.concat(arr);
        }
        else{
            var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
            var b_dataview = new DataView(toArrayBuffer(sliceBuf));
            var value = b_dataview.getUint8(2) + 3;
            b_dataview.setUint8(2,value);
            var byte_padded = Buffer.from(secret_message_arr[i].toString());
            var arr = [newBuffer,Buffer.from(b_dataview.buffer),byte_padded];
            newBuffer = Buffer.concat(arr);
            i++;
        }
        dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
    }

    // open the file in writing mode, adding a callback function where we do the actual writing
    fs.open(pathMp3Stego, 'w+', function(err, fd) {
        if (err) {
            throw 'could not open file: ' + err;
        }
        fs.write(fd, newBuffer, 0, newBuffer.byteLength, 0, function(err) {
            if (err) throw 'error writing file: ' + err;
            fs.close(fd, function() {
                console.log('file audio salvato con successo!');
            });
        });
    });

});

function paddingStuff(dataFrame, buffer, char) {

}

function check_max_size_embed_byte(dataFrame, message,buf_dataview){

    while(mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
        totframes++;
        if(!dataFrame.header.frameIsPadded) {
            totframes_unpadded++;
        }
        dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
    }

    if(totframes_unpadded < secret_message.length)
        return false;

    while (secret_message.length < totframes_unpadded)
        secret_message += "#";
    return true
}



















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


