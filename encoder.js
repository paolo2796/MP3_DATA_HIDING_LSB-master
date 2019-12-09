"use strict";
//imports
const fs = require("fs");
const util = require("util");
const mp3Parser = require("mp3-parser");
const bw = require ("buffered-writer");
const BitArray = require('node-bitarray')



const two_bit1 = "00";
const two_bit2 = "01";
const two_bit3 = "10";
const two_bit4 = "11";

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
    var dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.offset);

    if(!check_max_embedbyte(dataFrame,secret_message,buf_dataview)){
        console.warn("Il messaggio è troppo grande per essere iniettato nel file audio corrente");
        console.warn("TOT FRAME " + totframes );
        //console.warn("TOT FRAME UNPADDED " + totframes_unpadded);
        process.exit(1);
    }
    console.log("TOT FRAMES " + totframes );
    console.log("PROCESSAMENTO IN CORSO ...");
    var message_bits = convert_to_binary(secret_message);
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
        fs.write(fd, newBuffer, 0, newBuffer.byteLength, 0, function(err) {
            if (err) throw 'error writing file: ' + err;
            fs.close(fd, function() {
                console.log('file audio salvato con successo!');
            });
        });
    });


});

//convert decimal to binary
function convert_to_binary(text) {
    var output = "";
    for (var i = 0; i < text.length; i++) {
        var string_no_padding = text[i].charCodeAt(0).toString(2);
        var zero_char = '0';
        var padding_string = zero_char.repeat(8 - string_no_padding.length);
        padding_string += string_no_padding;
        output += padding_string;
    }
    return output;
}


// convert binary to decimal
function bin_to_dec(bstr) {
    return parseInt((bstr + '')
        .replace(/[^01]/gi, ''), 2);
}

function formatDecToBinary(value,format){
    var binaryStr = null;
    if(value>=0){
        binaryStr = value.toString(2);
        while(binaryStr.length < format) {
            binaryStr = "0" + binaryStr;
        }
    }
    else{
        binaryStr = value.toString(2);
        binaryStr = binaryStr.substring(1);
        while(binaryStr.length < format) {
            binaryStr = "0" + binaryStr;
        }
        binaryStr = "-" + binaryStr;
    }


    return binaryStr;

}

function paddingStuff(dataFrame, buffer, char) {
    var sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
    var b_dataview = new DataView(toArrayBuffer(sliceBuf));
    var value = b_dataview.getUint8(2) + 3;
    b_dataview.setUint8(2,value);
    var byte_padded = Buffer.from(char);
    var arr = [newBuffer,Buffer.from(b_dataview.buffer),byte_padded];
    newBuffer = Buffer.concat(arr);
}

function invert_bit(bit_val){
    if(bit_val==='1'){
        return "0";
    }
    else{
        return "1";
    }
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



function substituteHeaderBit(dataFrame,buffer,bitchar){
    // recupero dataframe
    let sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
    let b_dataview = new DataView(toArrayBuffer(sliceBuf));
    // recupero ultimo byte del dataframe
    let lsb = b_dataview.getUint8(sliceBuf.length -1);
    // recupero primi due bit più significativi
    let msb = lsb.toString(2).substring(0,2);

    //sostituisco private bit dell'header frame
    if(msb == two_bit1){
        let byte_header_str = formatDecToBinary(b_dataview.getUint8(2),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-1);
        let byte_modified = bit_ + invert_bit(bitchar);
        let value_modified = bin_to_dec(byte_modified);
        b_dataview.setUint8(2,value_modified);
    }
    else if(msb == two_bit2){
        let byte_header_str = formatDecToBinary(b_dataview.getUint8(2),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-1);
        let byte_modified = bit_ + invert_bit(bitchar);
        let value_modified = bin_to_dec(byte_modified);
        b_dataview.setUint8(2,value_modified);
    }
    else if(msb == two_bit3){
        let byte_header_str = formatDecToBinary(b_dataview.getUint8(3),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-4);
        let byte_modified = bit_ + invert_bit(bitchar) + byte_header_str.substring(5);
        let value_modified = bin_to_dec(byte_modified);
        b_dataview.setUint8(3,value_modified);
    }
    else if(msb == two_bit4){
        let byte_header_str = formatDecToBinary(b_dataview.getUint8(3),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-3);
        let byte_modified = bit_ + invert_bit(bitchar) + byte_header_str.substring(6);
        let value_modified = bin_to_dec(byte_modified);
        b_dataview.setUint8(3,value_modified);
    }

    var arr = [newBuffer,Buffer.from(b_dataview.buffer)];
    newBuffer = Buffer.concat(arr);

}



function substituteLSB(dataFrame, buffer) {

    for (var i = dataFrame._section.offset + dataFrame.header._section.byteLength; i < dataFrame._section.nextFrameIndex ; i=i+2) {
        var value = buffer.getInt16(i);
        // hack avoid underflow
        if (value == -128)
            value = -127;

            var binaryStr = formatDecToBinary(value,15);
            var array = Array.from(binaryStr);
            array[array.length - 1] = Math.floor(Math.random() * (2 - 0));
            var binaryStr_altered = array.join("");
            var parsed_value = parseInt(binaryStr_altered, 2);
            buffer.setInt16(i, parsed_value);
    }

}







