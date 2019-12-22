"use strict";
//imports
const fs = require("fs");
const mp3Parser = require("mp3-parser");
const Utils = require('./utils.js');
const readline = require('readline');



const pathMp3Stego = "audio_stego.mp3";
var pathToMp3;
var pass_aes;
var newBuffer;
var secret_message;
var totframes=0;
var totframes_unpadded=0;

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("file originale (es: audio2.mp3) :", function(answer) {
    pathToMp3 = answer.length==0 ? "audio2.mp3" : answer;
    rl.question("passphrase : ", function(answer) {
        pass_aes = answer.length==0 ? "compressione" : answer;
        rl.question("testo da nascondere :", function(answer) {
            secret_message = answer.length==0 ? "messaggio_default" : answer;
            rl.close();
            if (!pathToMp3) {
                console.log("path file audio non corretto!");
                process.exit(0);
            }
            fs.readFile(pathToMp3, (error, buffer) => {
                if (error) {
                    console.error("" + error);
                    process.exit(1);
                }


                var buf_dataview = new DataView(toArrayBuffer(buffer));
                // tags (idv3) mp3
                const tags = mp3Parser.readTags(buf_dataview);
                // calcolo primo frame contenente dati audio
                var dataFrame = mp3Parser.readFrame(buf_dataview,tags[tags.length-1]._section.offset);

                // controllo se il testo segreto può essere iniettato all'interno del file cover
                if(!check_max_embedbyte(dataFrame,secret_message,buf_dataview)){
                    console.warn("Il messaggio è troppo grande per essere iniettato nel file audio corrente");
                    console.warn("TOT FRAME " + totframes );
                    //console.warn("TOT FRAME UNPADDED " + totframes_unpadded);
                    process.exit(1);
                }

                // cifro testo segreto
                var message_encrypt = Utils.encrypt_message_aes(secret_message,pass_aes);
                console.log("TOT FRAMES " + totframes );
                console.log("PROCESSAMENTO IN CORSO ...");
                // testo in bits
                var message_bits = Utils.text_to_binary(message_encrypt);
                var i=0;
                while(dataFrame!=null && mp3Parser.readFrame(buf_dataview,dataFrame._section.nextFrameIndex) != null) {
                    /* start substitute_header_bit_unused */
                    substituteHeaderBit(dataFrame,buffer,message_bits[i]);

                    // ottengo prossimo frame da analizzare
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

                // apre il file in modalità scrittura, passando la funzione di callback che verrà chiamata per la scrittura dei bytes
                fs.open(pathMp3Stego, 'w+', function(err, fd) {
                    if (err) {
                        throw 'could not open file: ' + err;
                    }
                    fs.write(fd, buffer, 0, buffer.byteLength, 0, function(err) {
                        if (err) throw 'error writing file: ' + err;
                        fs.close(fd, function() {
                            console.log('file audio salvato con successo! (audio_stego.mp3)');
                        });
                    });
                });


            });
        });
    });
});




// calcola numero di frames disponibili e verifica se c'è spazio per iniettare il testo
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

// sostituisce un bit dell'header frame relativo al campo {private,copyright,original}
function substituteHeaderBit(dataFrame,buffer,bitchar){
    // recupero dataframe
    let sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
    let b_dataview = new DataView(toArrayBuffer(sliceBuf));

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
        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(3),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-4);
        let byte_modified = bit_ +  Utils.invert_bit(bitchar) + byte_header_str.substring(5);
        let value_modified = Utils.bin_to_dec(byte_modified);
        buffer[dataFrame._section.offset + 3] = value_modified;
    }
    else if(msb == Utils.two_bit4){
        let byte_header_str = Utils.format_dec_to_binary(b_dataview.getUint8(3),8);
        let bit_=byte_header_str.substring(0,byte_header_str.length-3);
        let byte_modified = bit_ +  Utils.invert_bit(bitchar) + byte_header_str.substring(6);
        let value_modified = Utils.bin_to_dec(byte_modified);
        buffer[dataFrame._section.offset + 3] = value_modified;
    }
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



function paddingStuff(dataFrame, buffer, char) {
    let sliceBuf = buffer.slice(dataFrame._section.offset,dataFrame._section.nextFrameIndex);
    let b_dataview = new DataView(toArrayBuffer(sliceBuf));
    let value = b_dataview.getUint8(2) + 3;
    b_dataview.setUint8(2,value);
    let byte_padded = Buffer.from(char);
    let arr = [newBuffer,Buffer.from(b_dataview.buffer),byte_padded];
    newBuffer = Buffer.concat(arr);
}






