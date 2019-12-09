"use strict";
//imports
const fs = require("fs");
const util = require("util");
const mp3Parser = require("mp3-parser");
const bw = require ("buffered-writer");
const BitArray = require('node-bitarray');
const Utils = require('./utils.js');


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


fs.readFile(pathToMp3, (error, buffer) => {
    if (error) {
        console.error("" + error);
        process.exit(1);
    }


    var buf_dataview = new DataView(toArrayBuffer(buffer));
    const tags = mp3Parser.readTags(buf_dataview);
    var dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.offset);

    if(!check_max_embedbyte(dataFrame,secret_message,buf_dataview)){
        console.warn("Il messaggio è troppo grande per essere iniettato nel file audio corrente");
        console.warn("TOT FRAME " + totframes );
        //console.warn("TOT FRAME UNPADDED " + totframes_unpadded);
        process.exit(1);
    }
    console.log("TOT FRAMES " + totframes );
    console.log("PROCESSAMENTO IN CORSO ...");
    var message_bits = Utils.convert_to_binary(secret_message,8);
    var i=0;
    while(dataFrame!=null && mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
        /* start substitute_header_bit_unused */
        substituteHeaderBit(dataFrame,buffer,message_bits[i]);
        dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
        i++;
        /* end substitute_header_bit_unused */

        /* padding stuff
        if(dataFrame.header.frameIsPadded) {
            var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
            var arr = [newBuffer,sliceBuf];
            newBuffer = Buffer.concat(arr);
        }
        else{
            paddingStuff(dataFrame,buffer,secret_message_arr[i].toString());
            i++;
        }
         end padding stuff */
    }

    // open the file in writing mode, adding a callback function where we do the actual writing
    fs.open(pathMp3Stego, 'w+', function(err, fd) {
        if (err) {
            throw 'could not open file: ' + err;
        }
        fs.write(fd, buffer, 0, buffer.byteLength, 0, function(err) {
            if (err) throw 'error writing file: ' + err;
            fs.close(fd, function() {
                console.log('file audio salvato con successo!');
            });
        });
    });


});




function substituteHeaderBit(dataFrame,buffer,bitchar){
    // recupero dataframe
    let sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
    let b_dataview = new DataView(toArrayBuffer(sliceBuf));
    //console.log("VALUE BEFORE : " + b_dataview.getUint8(3));

    // recupero ultimo byte del dataframe
    let lsb = b_dataview.getUint8(sliceBuf.length -1);
    // recupero primi due bit più significativi
    let msb = lsb.toString(2).substring(0,2);
    //sostituisco  bit dell'header frame
    if(msb == Utils.one_bit1 || msb == Utils.one_bit2){
        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(2),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-1);
        let byte_modified = bit_ + Utils.invert_bit(bitchar);
        let value_modified = Utils.bin_to_dec(byte_modified);
        buffer[dataFrame._section.offset + 2] = value_modified;
    }
    else if(msb == Utils.two_bit3){
        //console.log("two_bit3");
        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(3),8);
        //console.log(byte_header_str);
        let bit_=byte_header_str.substring(0,byte_header_str.length-4);
        //console.log("BIT CHAR:" + bitchar);
        //console.log("BIT CHAR INV:" + Utils.invert_bit(bitchar));
        let byte_modified = bit_ +  Utils.invert_bit(bitchar) + byte_header_str.substring(5);
        //console.log(byte_modified);
        let value_modified = Utils.bin_to_dec(byte_modified);
        buffer[dataFrame._section.offset + 3] = value_modified;
    }
    else if(msb == Utils.two_bit4){
        //console.log("two_bit4");
        //console.log("VALUE BEFORE : " + b_dataview.getUint8(3));
        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(3),8);
        //console.log(byte_header_str);
        let bit_=byte_header_str.substring(0,byte_header_str.length-3);
        //console.log("BIT CHAR:" + bitchar);
        //console.log("BIT CHAR INV:" + Utils.invert_bit(bitchar));
        let byte_modified = bit_ +  Utils.invert_bit(bitchar) + byte_header_str.substring(6);
        //console.log(byte_modified);
        let value_modified = Utils.bin_to_dec(byte_modified);
        buffer[dataFrame._section.offset + 3] = value_modified;
    }
    else{
        console.log("CO");
    }
}



//modifico bit meno significativo di ogni dataframe
function substituteLSB(dataFrame, buffer) {
    for (let i = dataFrame._section.offset + dataFrame.header._section.byteLength; i < dataFrame._section.nextFrameIndex ; i=i+2) {
        let value = buffer.getInt16(i);
        // hack avoid underflow
        if (value == -128)
            value = -127;

            let binaryStr = formatDecToBinary(value,15);
            let array = Array.from(binaryStr);
            array[array.length - 1] = Math.floor(Math.random() * (2 - 0));
            let binaryStr_altered = array.join("");
            let parsed_value = parseInt(binaryStr_altered, 2);
            buffer.setInt16(i, parsed_value);
    }

}


function paddingStuff(dataFrame, buffer, char) {
    let sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
    let b_dataview = new DataView(toArrayBuffer(sliceBuf));
    let value = b_dataview.getUint8(2) + 3;
    b_dataview.setUint8(2,value);
    let byte_padded = Buffer.from(char);
    let arr = [newBuffer,Buffer.from(b_dataview.buffer),byte_padded];
    newBuffer = Buffer.concat(arr);
}


function check_max_embedbyte(dataFrame, message,buf_dataview){

    while(mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
        totframes++;
        dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
    }


    if(totframes < secret_message.length * 8)
        return false;

    while (secret_message.length * 8 < totframes){
        secret_message += "#";
    }
    return true
}

function check_max_embedbyte_unpadding(dataFrame, message,buf_dataview){

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

const toArrayBuffer = buf => {
    const bufferLength = buf.length;
    const uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

    for (let i = 0; i < bufferLength; ++i) { uint8Array[i] = buf[i]; }
    return uint8Array.buffer;
};








