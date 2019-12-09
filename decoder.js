/*jshint node:true, esversion:6 */
"use strict";

const fs = require("fs");
const Utils = require("./utils.js");
const mp3Parser = require("mp3-parser");
const readline = require('readline');
var pass_aes;
const pathStegoMp3 = "audio_stego.mp3";


var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("passphrase : ", function(answer) {
        pass_aes = answer.length==0 ? "compressione" : answer;
            rl.close();

            if (!pathStegoMp3) {
                console.log("please invoke with path to MPEG audio file, i.e. 'node parse.js <file>'");
                process.exit(0);
            }
            fs.readFile(pathStegoMp3, (error, buffer) => {
                if (error) {
                    console.error("" + error);
                    process.exit(1);
                }
                let buf_dataview = new DataView(toArrayBuffer(buffer));
                const tags = mp3Parser.readTags(buf_dataview);
                let dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.offset);
                let bits_message="";
                let count=0;
                while(dataFrame!=null && mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
                    count++;
                    // recupero dataframe
                    let sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
                    let b_dataview = new DataView(toArrayBuffer(sliceBuf));
                    // recupero ultimo byte del dataframe
                    let last_byte = b_dataview.getUint8(sliceBuf.length -1);
                    // recupero primi due bit più significativi
                    let msb = last_byte.toString(2).substring(0,2);
                    // recupero bit messaggio dall'header frame in base al tipo di msb
                    if(msb == Utils.one_bit1 || msb == Utils.one_bit2){
                        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(2),8);
                        let bit_message = Utils.invert_bit(byte_header_str.charAt(byte_header_str.length-1));
                        bits_message +=bit_message;
                    }
                    else if(msb == Utils.two_bit3){
                        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(3),8);
                        let bit_message = Utils.invert_bit(byte_header_str.charAt(byte_header_str.length-4));
                        bits_message += bit_message;
                    }
                    else if(msb == Utils.two_bit4){
                        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(3),8);
                        let bit_message = Utils.invert_bit(byte_header_str.charAt(byte_header_str.length-3));
                        bits_message += bit_message;
                    }
                    dataFrame = mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex);
                }
                let message_encrypt = ascii_from_bits(bits_message);
                // decifro il testo e rimuovo eventuali caratteri di padding
                let message_decrypt = Utils.decrypt_message_aes(message_encrypt,pass_aes).split("#")[0];
                console.log("testo segreto: " + message_decrypt);
            });
});


function ascii_from_bits(bits){
    var arr = bits.match(/.{1,8}/g);
    let message ="";
    for(let i=0;i< arr.length;i++){
        message += String.fromCharCode(parseInt(arr[i], 2).toString(10));
    }

    return message;
}

const toArrayBuffer = buf => {
    const bufferLength = buf.length;
    const uint8Array = new Uint8Array(new ArrayBuffer(bufferLength));

    for (let i = 0; i < bufferLength; ++i) { uint8Array[i] = buf[i]; }
    return uint8Array.buffer;
};
