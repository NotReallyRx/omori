//=============================================================================
// OggOnly.js
// PUBLIC DOMAIN
// ----------------------------------------------------------------------------
// 2018/07/23 国際化と微修正
//=============================================================================

/*:
 * @plugindesc Use only m4a (AAC) files to play the audio.
 * @author krmbn0576
 *
 * @help
 * Forces AudioManager to request .m4a audio files, which every browser
 * decodes natively (no Ogg/stbvorbis decoder needed).
 *
 * License:
 * PUBLIC DOMAIN
 */

/*:ja
 * @plugindesc 音声ファイルの再生にm4a（AAC）ファイルのみを使用します。
 * @author くらむぼん
 *
 * @help
 * AudioManagerが.m4a音声ファイルのみを要求するようにします。
 * ブラウザが標準でデコードできるため、Ogg/stbvorbisデコーダーは不要です。
 *
 * ライセンス：
 * このプラグインの利用法に制限はありません。お好きなようにどうぞ。
 */

(function() {
    'use strict';
    var parameters = PluginManager.parameters('OggOnly');

    // ただただ互換性回復のため再定義。 / Recover compatiblity.
    Utils.isOptionValid = function(name) {
        if (location.search.slice(1).split('&').contains(name)) return true;
        if (typeof window.nw !== "undefined" && nw.App.argv.length > 0 && nw.App.argv[0].split('&').contains(name)) return true;
        return name === 'test' && !Utils.isNwjs();
    };

    AudioManager.audioFileExt = function() {
        return '.m4a';
    };
})();