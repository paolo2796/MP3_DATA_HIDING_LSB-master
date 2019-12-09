exports.one_bit1 = "0";
exports.one_bit2 = "1";
exports.two_bit3 = "10";
exports.two_bit4 = "11";

//convert decimal to binary
exports.convert_to_binary =
function (text,format) {
    var output = "";
    for (var i = 0; i < text.length; i++) {
        var string_no_padding = text[i].charCodeAt(0).toString(2);
        var zero_char = '0';
        var padding_string = zero_char.repeat(format - string_no_padding.length);
        padding_string += string_no_padding;
        output += padding_string;
    }
    return output;
}


// convert binary to decimal
exports.bin_to_dec =
function (bstr) {
    return parseInt((bstr + '')
        .replace(/[^01]/gi, ''), 2);
}

exports.format_dec_to_binary=
function (value,format){
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

exports.invert_bit =
function (bit_val){
    if(bit_val==='1'){
        return "0";
    }
    else{
        return "1";
    }
}