/*jshint esversion: 6 */
var availableTags;
var currentDeck;
var currentFields;
var currentTags;
var currentNoteType;
var debugStatus;
var savedFormFields = savedFormFields || [];
var appendModeSettings;
var connectionStatus;
var deckNamesSaved;
var modelNamesSaved;
var storedFieldsForModels = storedFieldsForModels || {};
var syncFrequency;
var onceTimeForceSync;
var favourites = {};
var editor;
var allSettings = {};
var port = chrome.extension.connect({
    name: "ankiadder"
});
chrome.runtime.sendMessage({
    "action": "wakeup"
});


//Restore User Settings on load of page
document.addEventListener('DOMContentLoaded', restore_options);



//only called when user clear all settings.
function restore_defaults() {
    saveChanges("appendModeSettings", "1");
    saveChanges("debugStatus", "0");
    saveChanges("syncFrequency", "Manual");
    allSettings.forcePlainText = "true";
    allSettings.cleanPastedHTML = "true";
    saveChanges("allSettings", allSettings);
}

//restore user settings on load of page
function restore_options() {
    getChanges("debugStatus"); //default
    getChanges("favourites");
    getChanges("deckNamesSaved");
    getChanges("syncFrequency"); //default
    getChanges("currentDeck");
    getChanges("currentNoteType");
    getChanges("currentFields");
    getChanges("storedFieldsForModels");
    getChanges("appendModeSettings"); //default
    getChanges("modelNamesSaved");
    getChanges("getTagsSaved");
    getChanges("allSettings");




}



const deckNames = function () {
    background.ankiConnectRequest('deckNames', 6)
        .then(function (fulfilled) {
            var textFieldValue;
            var counter = 0;
            $.each(fulfilled.sort(), function (key, value) {
                //cleaning names
                if (value.indexOf("::") !== -1) {
                    var lengthParent = value.substring(0, value.lastIndexOf("::") + 2).length;
                    var spaceLength = lengthParent - 10 > 3 ? lengthParent - 10 : "5";

                    var last = value.substring(value.lastIndexOf("::") + 2, value.length);
                    //    space workaround for html
                    textFieldValue = "\xA0".repeat(spaceLength) + last;
                } else {
                    textFieldValue = value;

                }


                if (value == currentDeck) {
                    counter++;
                    $('#deckList')
                        .append($("<option></option>")
                            .attr("value", value)
                            .attr('selected', 'selected')
                            .text(textFieldValue));


                } else {
                    counter++;
                    $('#deckList')
                        .append($("<option></option>")
                            .attr("value", value)
                            .text(textFieldValue));


                }

                    $('#FavouriteDeck')
                        .append($("<option></option>")
                            .attr("value", value)
                            .text(textFieldValue));


            });


            if (typeof currentDeck == "undefined" || counter == 1 || currentDeck == "noCurrentDeck") //Deal with errors
            {

                var value = $('#deckList').find("option:first-child").val();
                $("#deckList option:eq(0)").attr("selected", "selected");
                currentDeck = value;
                saveChanges("currentDeck", value);
            }
        })
        .catch(function (error) {
            //Handle Error

            connectionStatus = "false";
            saveChanges("connectionStatus", "false");
            errorLogs.innerHTML = "<p>Connection Refused!!</p>This extension needs <a href='https://apps.ankiweb.net'>Anki</a> in background.<p>Please, run Anki.</p> Finally, please install <a href='https://ankiweb.net/shared/info/2055492159'> Anki connect plugin (V6).</a> (if not installed).<br><p>Right click on these links to open</p>";

            debugLog(error);

        });
};



var modelNames = function () {
    background.ankiConnectRequest('modelNames', 6)
        .then(function (fulfilled) {
            var counter = 0;
            $.each(fulfilled.sort(), function (key, value) {

                if (value == currentNoteType) {
                    counter++;
                    $('#modelList')
                        .append($("<option></option>")
                            .attr("value", value)
                            .attr('selected', 'selected')
                            .text(value));

                } else {
                    counter++;

                    $('#modelList')
                        .append($("<option></option>")
                            .attr("value", value)
                            .text(value));
                }

                //    create favs
                if (value == favourites.model) {
                    $('#FavouriteModel')
                        .append($("<option></option>")
                            .attr("value", value)
                            .attr('selected', 'selected')
                            .text(value));


                } else {
                    $('#FavouriteModel')
                        .append($("<option></option>")
                            .attr("value", value)
                            .text(value));


                }


            });
            // debugLog(fulfilled);
            //Error
            if (typeof currentNoteType == "undefined" || currentNoteType == "noCurrentModel" || counter == 1) {
                // if(counter==1)
                // {
                //     selectFirstElement("#modelList");
                // }
                var value = $('#modelList').find("option:first-child").val();

                $("#modelList option:eq(0)").attr("selected", "selected");
                currentNoteType = value;
                saveChanges("currentNoteType", value);
                cardFields(value);
            } else {

                cardFields(currentNoteType);

            }

        })
        .catch(function (error) {
            //Handle Error

            debugLog(error);

        });
};


var getTags = function () {

    background.ankiConnectRequest('getTags', 6)
        .then(function (fulfilled) {
            availableTags = fulfilled;
            // debugLog(availableTags);


            function split(val) {
                return val.split(/;\s*/);
            }

            function extractLast(term) {
                return split(term).pop();
            }

            $("#tags")
            // don't navigate away from the field on tab when selecting an item
                .on("keydown", function (event) {
                    if (event.keyCode === $.ui.keyCode.TAB &&
                        $(this).autocomplete("instance").menu.active) {
                        event.preventDefault();
                    }
                })
                .autocomplete({
                    minLength: 0,
                    source: function (request, response) {
                        // delegate back to autocomplete, but extract the last term
                        response($.ui.autocomplete.filter(
                            fulfilled, extractLast(request.term)));
                    },
                    focus: function () {
                        // prevent value inserted on focus
                        return false;
                    },
                    select: function (event, ui) {
                        var terms = split(this.value);
                        // remove the current input
                        terms.pop();
                        // add the selected item
                        terms.push(ui.item.value);
                        // add placeholder to get the comma-and-space at the end
                        terms.push("");
                        this.value = terms.join("; ");
                        return false;
                    }
                });

        })
        .catch(function (error) {
            // log error
            debugLog(error.message);
        });
};



var cardFields = function (item) {

    if (storedFieldsForModels.hasOwnProperty(item)) {
        currentFields = storedFieldsForModels[item];
        saveChanges("currentFields", storedFieldsForModels[item]);
        restore_All_Fields(storedFieldsForModels[item], item);
        errorLogs.innerHTML = '';
    } else {


        var params = {
            modelName: item
        };
        // debugLog(params);
        background.ankiConnectRequest('modelFieldNames', 6, params)
            .then(function (fulfilled) {
                currentFields = fulfilled;
                saveChanges("currentFields", fulfilled);

                storedFieldsForModels[item] = fulfilled;
                saveChanges("storedFieldsForModels", storedFieldsForModels);

                restore_All_Fields(fulfilled, item);
            })
            .catch(function (error) {
                saveChanges("connectionStatus", "false");

                if (background.findRegex("failed to connect", error)) {
                    $('#addCard').empty();
                    if (typeof item == "undefined") {
                        item = 'card';
                    }
                    $('#addCard').html("<p><span style=\"color:red;\">No connection!!</span> <br><span style=\"color:#0000ff;\">fields of " + item + "</span> were not cached yet.<br><br>Run Anki and open extension again</p>");

                    debugLog(error);

                } else if (error == null) {
                    $('#addCard').empty();
                    $('#addCard').html("<p><span style=\"color:red;\">Model " + currentNoteType + " is deleted in Anki.Create it or <input type='button' id='deleteModelFromCache' class='deleteModel' value='delete From cache'></span></p>");
                } else {
                    $('#addCard').empty();
                    $('#addCard').html("<p><span style=\"color:red;\">Model type not found. Please create it and refresh cache</span></p><input type='button' id='refreshData' class='refreshModel' style='background-color:#ffa500;'value='Refresh Models'>");

                }




            });



    }
};

function removeSettings(value) {
    if (!value) {
        return;
    } else {

        chrome.storage.sync.remove(value, function (Items) {
            debugLog("settings removed" + value);

        });

    }
}

function getShortcutValues(){
    for (var key in favourites.shortcuts) {

        {
            $("#change" + key + "Shortcut").val(favourites.shortcuts[key]+" (change)");
        }

    }

}



function restoreShortcuts(){


        var shortcuts = {
            Deck: "alt+shift+d",
            Cloze: "alt+shift+w",
            QuickSubmit: "ctrl+enter",
            Model:"alt+shift+c"

        };
        favourites.shortcuts = shortcuts;
        saveChanges("favourites",favourites);
        rebindAllKeys();
         getShortcutValues();

    notifySetting("The default shortcuts have been restored.")
}
function restore_All_Fields(fulfilled, item) {

    $("#addCard").empty();

    $.each(fulfilled, function (key, value) {
        if (savedFormFields.hasOwnProperty(value)) {
            fieldvalue = savedFormFields[value].replace(/<br>/gi, "\n");
            $('#addCard').append('<label for="' + value + '-Field">' + value + '</label><textarea type="text" class="fieldsToMaintain" id="' + value + '-Field" name="' + value + '">' + fieldvalue + '</textarea><br>');

        } else {

            $('#addCard').append('<label for="' + value + '-Field">' + value + '</label><textarea type="text" class="fieldsToMaintain" id="' + value + '-Field" name="' + value + '"></textarea><br>');

        }
    });

    //disabled due to add shortcut for fields
    // var moveFields = {
    //     '#Question-Field': '#Answer-Field',
    //     '#Front-Field': '#Back-Field'
    // };
    // $.each(moveFields, function (key, value) {
    //
    //     $(key).each(function () {
    //
    //         if ($(this).isAfter(value)) {
    //
    //             var keyOrignal = key.replace("#", "").split("-");
    //             $(key).prev("label").remove();
    //             $("textarea" + key).remove();
    //
    //             if (savedFormFields.hasOwnProperty(keyOrignal[0])) {
    //                 fieldvalue = savedFormFields[keyOrignal[0]].replace(/<br>/gi, "\n");
    //
    //                 $('<label for=' + keyOrignal[0] + '-Field">' + keyOrignal[0] + '</label><textarea type="text" class="fieldsToMaintain" id="' + keyOrignal[0] + '-Field" name="' + keyOrignal[0] + '">' + fieldvalue + '</textarea><br>').insertBefore($(value).prev("label"));
    //
    //             } else {
    //                 $('<label for=' + keyOrignal[0] + '-Field">' + keyOrignal[0] + '</label><textarea type="text" class="fieldsToMaintain" id="' + keyOrignal[0] + '-Field" name="' + keyOrignal[0] + '"></textarea><br>').insertBefore($(value).prev("label"));
    //
    //
    //             }
    //         }
    //     });
    // });
    saveChanges("connectionStatus", "true");
    runAfterElementExists(".fieldsToMaintain", function () {
        createDynamicFields();
    });


}

function getChanges(key) {
    var valueReturn;
    chrome.storage.sync.get([key], function (result) {
        // debugLog('Value currently is ' + result[key]');
        valueReturn = result[key];
        if (typeof valueReturn != "undefined") {
            setValue(key, valueReturn);

        } else {
            debugLog(key + " is undefined or" + valueReturn);
        }

    });
    // chrome.storage.sync.get(null, function (data) { console.info(data) });
}

function setValue(key, valueReturn) {
    window[key] = valueReturn;
    debugLog("key is" + key + "and value retreived below");
    debugLog(valueReturn);

}




function init() {

    chrome.runtime.getBackgroundPage(function (background) {
        // Do stuff here that requires access to the background page.
        // E.g. to access the function 'myFunction()'
        window.background = background;
        try {
            //get data from backgroundPage
            savedFormFields = background.fieldsSync();
            debugLog(savedFormFields);
        } catch (e) {
            debugLog(e);
            //if no data initialize array
            savedFormFields = [];
        }

        //grab deck names
        deckNames();
        // Fields names are retreived inside modelNames()
        modelNames();
        //Tags for AutoComplete
        getTags();

        // select default sync hide and show


    });




}

function runAfterElementExists(jquery_selector, callback) {
    var checker = window.setInterval(function () {
        //if 1 or more elements found
        if ($(jquery_selector).length) {

            //stop checking
            clearInterval(checker);

            //call the passed in function via the parameter above
            callback();
        }
    }, 300);
}


function createDynamicFields() {
    /**
     * Custom `color picker` extension
     */
    var ColorPickerExtension = MediumEditor.extensions.button.extend({
        name: "colorPicker",
        action: "applyForeColor",
        aria: "color picker",
        contentDefault: "<span class='editor-color-picker'>Text Color<span>",

        init: function () {
            this.button = this.document.createElement('button');
            this.button.classList.add('medium-editor-action');
            this.button.innerHTML = '<b>color</b>';

            initPicker(this.button);
        }
    });

    var pickerExtension = new ColorPickerExtension();


    function setColor(color) {
        pickerExtension.base.importSelection(this.selectionState);
        pickerExtension.document.execCommand("styleWithCSS", false, true);
        pickerExtension.document.execCommand("foreColor", false, color);
    }

    function initPicker(element) {
        $(element).spectrum({
            allowEmpty: true,
            color: "#f00",
            showInput: true,
            showAlpha: true,
            showPalette: true,
            showInitial: true,
            hideAfterPaletteSelect: false,
            preferredFormat: "hex3",
            change: function (color) {
                setColor(color);
            },
            hide: function (color) {
                //applyColor(color);
            },
            palette: [
                ["#000", "#444", "#666", "#999", "#ccc", "#eee", "#f3f3f3", "#fff"],
                ["#f00", "#f90", "#ff0", "#0f0", "#0ff", "#00f", "#90f", "#f0f"],
                ["#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc"],
                ["#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
                ["#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6fa8dc", "#8e7cc3", "#c27ba0"],
                ["#c00", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3d85c6", "#674ea7", "#a64d79"],
                ["#900", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#0b5394", "#351c75", "#741b47"],
                ["#600", "#783f04", "#7f6000", "#274e13", "#0c343d", "#073763", "#20124d", "#4c1130"]
            ]
        });
    }
    if (typeof allSettings.forcePlainText == "undefined" || allSettings.forcePlainText != "true" || allSettings.forcePlainText != "false") {
        // allSettings["forcePlainText"] = true;
    }
    if (typeof allSettings.cleanPastedHTML == "undefined" || allSettings.cleanPastedHTML != "true" || allSettings.cleanPastedHTML != "false") {
        // allSettings["cleanPastedHTML"] = true;
    }

    editor = new MediumEditor('.fieldsToMaintain', {
        paste: {
            forcePlainText: allSettings.forcePlainText,
            cleanPastedHTML: allSettings.cleanPastedHTML,
            cleanReplacements: [],
            cleanAttrs: ['class', 'style', 'dir'],
            cleanTags: ['meta'],
            unwrapTags: []
        },
        placeholder: false,
        toolbar: {
            buttons: ['colorPicker',
                'bold',
                'italic',
                'underline',
                //You can add other options also. left H1 for reference
                // {
                //     name: 'h1',
                //     action: 'append-h2',
                //     aria: 'header type 1',
                //     tagNames: ['h2'],
                //     contentDefault: '<b>H1</b>',
                //     classList: ['custom-class-h1'],
                //     attrs: {
                //         'data-custom-attr': 'attr-value-h1'
                //     }
                // },
                // {
                //     name: 'h2',
                //     action: 'append-h3',
                //     aria: 'header type 2',
                //     tagNames: ['h3'],
                //     contentDefault: '<b>H2</b>',
                //     classList: ['custom-class-h2'],
                //     attrs: {
                //         'data-custom-attr': 'attr-value-h2'
                //     }
                // },
                'pre',
                'justifyCenter',
            ]
        },
        extensions: {
            'colorPicker': pickerExtension
        }
    });
    var triggerAutoSave = function (event, editable) {

        var textarea = jQuery(editable).next();
        var textareaId = textarea.attr('id');
        var key = textareaId.replace("-Field", "");

        savedFormFields[key] = "" + editable.innerHTML + "";
        debugLog("savedFormFields +live save");


        saveChanges("savedFormFields", savedFormFields);

        textarea.text(jQuery(editable).html()).trigger("change");

    };

    var throttledAutoSave = MediumEditor.util.throttle(triggerAutoSave, 1000); // 1 second

    // Listening to event
    editor.subscribe('editableInput', throttledAutoSave);



}

function notifyError(data) {

    errorLogs.innerHTML = data;
    setTimeout(function () {
        errorLogs.innerHTML = "";
    }, 3000);
}
function notifyShortcut(data) {

    shortcutsLog.innerHTML = data;
    }

function notifySetting(data) {

    settingsLog.innerHTML = data;
    setTimeout(function () {
        settingsLog.innerHTML = "";
    }, 3000);
}

function selectFavourite(optionValue, whatElement, type) {


    //find element select

    var value;
    var currentSelected;
    var counter;
    //if element, change and save it
    var favToSelect;
    if (type == "currentDeck") {
        currentSelected = currentDeck;
        if(typeof favourites.deckCounter=="undefined"||favourites.deckCounter >=favourites.deck.length)
        {
            favourites.deckCounter  = 0;

        }
        favToSelect =   favourites.deck[favourites.deckCounter];
        favourites.deckCounter  = favourites.deckCounter+1;
        value  = $(whatElement).find('option[value="' + favToSelect + '"]').val();
    } else {
        currentSelected = currentNoteType;
        if(typeof favourites.modelCounter=="undefined"||favourites.modelCounter >=favourites.model.length)
        {
            favourites.modelCounter  = 0;

        }
        favToSelect =   favourites.model[favourites.modelCounter];
        favourites.modelCounter  = favourites.modelCounter+1;
        value  = $(whatElement).find('option[value="' + favToSelect + '"]').val();
    }
    if (value) {
        if (value != currentSelected) {
            $(whatElement + ' option[selected="selected"]').each(
                function () {
                    $(this).removeAttr('selected');
                }
            );

            $(whatElement).val(favToSelect).change();
            // currentDeck = value;
            // saveChanges()
            debugLog(whatElement + " Selected");
            saveChanges(type, value);
        }

    } else


    {
        notifyError("No " + type + " is selected as favourite. Please, select in settings");
    }

}

function rebindAllKeys() {
    if(typeof favourites.shortcuts=="undefined")
    {
        var shortcuts = {
            Deck: "alt+shift+d",
            Cloze: "alt+shift+w",
            QuickSubmit: "ctrl+enter",
            Model:"alt+shift+c"

        };
        favourites.shortcuts = shortcuts;
        saveChanges("favourites",favourites);
    }

    Mousetrap.bind(favourites.shortcuts.Deck, function (e) {
        selectFavourite(favourites.deck, "#deckList", "currentDeck");
    });

    Mousetrap.bind(favourites.shortcuts.Model, function (e) {

        selectFavourite(favourites.model, "#modelList", "currentNoteType");
    });
    Mousetrap.bind(favourites.shortcuts.Cloze, function (e) {
        selectCloze();

    });
    Mousetrap.bind(favourites.shortcuts.QuickSubmit, function (e) {
        submitToAnki();
    });


}





//wait for document to load
$(document).ready(function () {

    //create decks and models
    init();
    //create tabs
    $("#tabs").tabs();
    $('.multipleSelect2').select2(
        {
            width: null
        }
    );
    //multiple selection for decks and cloze


    //restore settings state when user click setting page

    $(document).on('click', '#ui-id-2', function () {
        //sync
        $('#syncSetting option[value=' + syncFrequency + ']').attr('selected', 'selected');
        //sync

        $('#forcePlainText option[value=' + allSettings.forcePlainText + ']').attr('selected', 'selected');

        $('#cleanPastedHTML option[value=' + allSettings.cleanPastedHTML + ']').attr('selected', 'selected');
        $('#FavouriteDeck').val(favourites.deck);
        $('#FavouriteDeck').trigger('change');
        $('#FavouriteModel').val(favourites.model);
        $('#FavouriteModel').trigger('change');


    });


    $(document).on('click', '#ui-id-3', function () {
            getShortcutValues();
       });

    if (syncFrequency == "Live") {


        $(".refreshData").hide();
    } else {
        $(".refreshData").show();


    }
    //Monitors currentDeck value.
    $('#FavouriteDeck').change(function () {
        var value = $(this).select2('data');
        currentFav = [];
        for(var item of value)
        {
            currentFav.push(item.id);
        }
        favourites.deck = currentFav;

      saveChanges("favourites", favourites);

    });
    $('#FavouriteModel').change(function () {
        var value = $(this).select2('data');
        var currentFav = [];
        for(var item of value)
        {
            currentFav.push(item.id);
        }
        favourites.model = currentFav;

        saveChanges("favourites", favourites);
    });

    $('#deckList').change(function () {
        var value = $(this).val();
        currentDeck = value;
        saveChanges("currentDeck", value);

    });

    //Monitors currentNoteType value.

    $('#modelList').change(function () {
        var value = $(this).val();
        // debugLog(value)
        currentNoteType = value;
        saveChanges("currentNoteType", value);
        cardFields(value);
        //clear saved Setting on background.js
        //  clearTextBoxes();



    });

    $('#syncSetting').change(function () {
        var value = $(this).val();
        // debugLog(value)
        syncFrequency = value;
        saveChanges("syncFrequency", value);
        notifySetting("Sync has been set to " + syncFrequency);
        if (syncFrequency == "Live") {


            $(".refreshData").hide();
        } else {
            $(".refreshData").show();


        }

    });

    $('#forcePlainText').change(function () {
        var value = $(this).val();
        allSettings.forcePlainText = value;
        saveChanges("allSettings", allSettings);
    });
    $('#cleanPastedHTML').change(function () {
        var value = $(this).val();
        allSettings.cleanPastedHTML = value;
        saveChanges("allSettings", allSettings);

    });

    function strcmp(a, b) {
        if (a.toString() < b.toString()) return -1;
        if (a.toString() > b.toString()) return 1;
        return 0;
    }



    $(".shortcut").click(function () {
        var currentId = $(this).attr('id');
        var id = currentId.replace(/change(.*?)Shortcut/g, '$1');
        notifyShortcut("Please press the shortcut Keys for favourite" + id);

                Mousetrap.record(function(sequence) {


                    var shortcutPresent = false;
                    var assignedShortcut =0;
                    var userPressedKeys = sequence.join(' ');
                    for (var key in favourites.shortcuts) {
                        if(strcmp(userPressedKeys,favourites.shortcuts[key])==0)
                        {
                            shortcutPresent =true;
                            assignedShortcut = key;
                            break;
                        }
                    }

                    if(shortcutPresent==false)
                    {
                        if(typeof favourites.shortcuts=="undefined")
                        {
                            favourites.shortcuts = {};

                        }

                        shortcutId = sequence.join(' ');
                        notifyShortcut(shortcutId+" is set for "+id+" shortcut");
                        favourites.shortcuts[id] =shortcutId;
                        saveChanges("favourites",favourites);
                        Mousetrap.reset();
                        rebindAllKeys();
                        getShortcutValues();
                        //    call all shortcuts again


                    }
                    else {
                        notifyShortcut(userPressedKeys+" is already assigned to " +assignedShortcut);

                    }

                });



    });



    //reset button
    $("#resetButton").click(function () {
        clearTextBoxes();
    });



    $("#clearAllDefaults").click(function () {
        clearNotes();

    });
    //delete extension
    $("#nukeExtension").click(function () {
        deleteExtension();

    });


    $("#appendFields").click(function () {
        appendFields();

    });

    $("#changeDebugMode").click(function () {
        changeDebugMode();

    });


    $("#reloadChromeMenu").click(function () {
        if (typeof deckNamesSaved != "undefined") {}
        reloadExtension();

    });




    $(document).on('click', '#refreshDecks', function () {
        removeSettings("currentDeck");
        removeSettings("deckNamesSaved");
        currentDeck = "noCurrentDeck";
        location.reload();


    });
    $(document).on('click', '#refreshModel, .refreshModel', function () {
        $('#addCard').empty();
        removeSettings("modelNamesSaved");
        removeSettings("currentNoteType");
        currentNoteType = "noCurrentModel";
        location.reload();


    });



    $(document).on('click', '#refreshTags', function () {
        removeSettings("getTagsSaved");
        location.reload();

    });

    $(document).on('click', '#deleteDeckFromCache', function () {
        var deckToDelete = currentDeck;
        if (typeof deckToDelete != "undefined") {
            debugLog(deckToDelete);
            if (removeFromArray(deckNamesSaved, deckToDelete)) {
                saveChanges("deckNamesSaved", deckNamesSaved);

            }

            // debugLog(modelNamesSaved);

            $("#deckList option[value='" + deckToDelete + "']").remove();

            removeSettings("currentDeck");
            onceTimeForceSync = 1;
            location.reload();

        }



    });



    $(document).on('click', '#deleteModelFromCache', function () {
        var ModelToDelete = currentNoteType;
        if (typeof ModelToDelete != "undefined") {
            debugLog(ModelToDelete);
            if (removeFromArray(modelNamesSaved, currentNoteType)) {
                saveChanges("modelNamesSaved", modelNamesSaved);

            }

            debugLog(modelNamesSaved);

            $("#modelList option[value='" + ModelToDelete + "']").remove();
            if (storedFieldsForModels.hasOwnProperty(currentNoteType)) {
                removeSettings("currentFields");
                delete storedFieldsForModels[ModelToDelete];
                debugLog(storedFieldsForModels);
                saveChanges("storedFieldsForModels", storedFieldsForModels);
                removeSettings("currentNoteType");

                errorLogs.innerHTML = '';
                onceTimeForceSync = 1;

                location.reload();
            } else {

                removeSettings("currentNoteType");
                currentNoteType = "as";
                onceTimeForceSync = 1;
                location.reload();
                errorLogs.innerHTML = 'Please, reload extension by clicking Popup icon.';

            }


        }

    });
    //reset button
    $("#restoreShortcuts").click(function () {
        restoreShortcuts();
    });



    //    act on form
    $('#form1').submit(function (event) {
        event.preventDefault();
        submitToAnki();

    });


    $("#syncAnkiToWeb").click(function () {
        syncAnkiToAnkiWeb();

    });

    Mousetrap.prototype.stopCallback = function(e, element, combo, sequence) {
        var self = this;

        if (self.paused) {
            return true;
        }
        else {
            return false;
        }

    };

    //bind keys
    rebindAllKeys();


});


function recordSequence() {
    Mousetrap.record(function(sequence) {
        // sequence is an array like ['ctrl+k', 'c']
        return sequence.join(' ');
    });
}


function selectCloze() {

    var activeId = document.activeElement.id;

    if (activeId.includes("medium-editor-")) {
        //in current medium editor..
        var presentClozes = [];
        var clozeNumber;
        var currentContent = $('#' + activeId).html();
        //find current clozed in the match
        currentContent.replace(/{{[c]([\d]{1,3})::/igm, function (m, p1) {
            //callback: push only unique values
            if (presentClozes.indexOf(p1) == -1) presentClozes.push(p1);

        });

        if (presentClozes.sort(function(a,b)
        {
            return a-b;
        }).slice(-1)[0]) {
            clozeNumber = parseInt(presentClozes.sort(function(a,b)
            {
                return a-b;
            }).slice(-1)[0]) + 1;

        } else {
            clozeNumber = "1";
        }

        var text = "";
        if (window.getSelection) {
            text = window.getSelection().toString();
        } else if (document.selection && document.selection.type != "Control") {
            text = document.selection.createRange().text;
        }
        var currentSelection = saveSelection(document.activeElement);

        var replacementText = "{{c" + clozeNumber + "::" + text + "}}";
        pasteHtmlAtCaret(replacementText);
        if(currentSelection.end-currentSelection.start=="0")
        {
            setCaretCharIndex($("#"+activeId)[0], currentSelection.start+6);

        }
        else
        {
            setCaretCharIndex($("#"+activeId)[0], currentSelection.end+8);

        }
        // editor.trigger('editableInput', {}, document.activeElement);

    }
}
//Functions by Tim Down from Rangy libray
function saveSelection(containerEl) {
    var charIndex = 0, start = 0, end = 0, foundStart = false, stop = {};
    var sel = window.getSelection(), range;

    function traverseTextNodes(node, range) {
        if (node.nodeType == 3) {
            if (!foundStart && node == range.startContainer) {
                start = charIndex + range.startOffset;
                foundStart = true;
            }
            if (foundStart && node == range.endContainer) {
                end = charIndex + range.endOffset;
                throw stop;
            }
            charIndex += node.length;
        } else {
            for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                traverseTextNodes(node.childNodes[i], range);
            }
        }
    }

    if (sel.rangeCount) {
        try {
            traverseTextNodes(containerEl, sel.getRangeAt(0));
        } catch (ex) {
            if (ex != stop) {
                throw ex;
            }
        }
    }

    return {
        start: start,
        end: end
    };
}
//Functions by Tim Down from Rangy libray
function setCaretCharIndex(containerEl, index) {
    var charIndex = 0, stop = {};
    function traverseNodes(node) {
        if (node.nodeType == 3) {
            var nextCharIndex = charIndex + node.length;
            if (index >= charIndex && index <= nextCharIndex) {
                window.getSelection().collapse(node, index - charIndex);
                throw stop;
            }
            charIndex = nextCharIndex;
        }
        // Count an empty element as a single character. The list below may not be exhaustive.
        else if (node.nodeType == 1
            && /^(input|br|img|col|area|link|meta|link|param|base)$/i.test(node.nodeName)) {
            charIndex += 1;
        } else {
            var child = node.firstChild;
            while (child) {
                traverseNodes(child);
                child = child.nextSibling;
            }
        }
    }

    try {
        traverseNodes(containerEl);
    } catch (ex) {
        if (ex != stop) {
            throw ex;
        }
    }
}
function pasteHtmlAtCaret(html) {
    var sel, range;
    if (window.getSelection) {
        // IE9 and non-IE
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();

            // Range.createContextualFragment() would be useful here but is
            // non-standard and not supported in all browsers (IE9, for one)
            var el = document.createElement("div");
            el.innerHTML = html;
            var frag = document.createDocumentFragment(), node, lastNode;
            while ( (node = el.firstChild) ) {
                lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);

            // Preserve the selection
            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    } else if (document.selection && document.selection.type != "Control") {
        // IE < 9
        document.selection.createRange().pasteHTML(html);
    }
}

function removeFromArray(array, element) {
    const index = array.indexOf(element);

    if (index !== -1) {
        array.splice(index, 1);
        return true;
    } else {
        return false;
    }
}

function syncAnkiToAnkiWeb() {

    background.ankiConnectRequest('sync', 6)
        .then(function (fulfilled) {
            debugLog(fulfilled);

        })
        .catch(function (error) {
            background.notifyUser(error, "notifyAlert");
        });

}




function submitToAnki() {

    //Getting Field types
    currentTags = $('#tags').val();

    if (typeof currentTags != "undefined") {
        currentTags = currentTags.replace(/;/g, ",");
    } else {
        currentTags = "";

    }

    //replace tags
    debugLog("currenttags" + currentTags);
    var counter = 0;
    var arrayToSend = {};
    var sendValue;
    $.each(currentFields, function (index, value) {

        debugLog(index + ": " + value);
        try {
            var textfieldValue = $('#' + value + '-Field').val();
            if (typeof textfieldValue != "undefined" || textfieldValue != "<p><br></p>" || textfieldValue != "<p></p>") {
                sendValue = textfieldValue;
                counter++;
            } else {

                sendValue = "";
            }
        } catch (error) {
            sendValue = "";
            notifyError("Please edit your card. Can't parse ID" + value);
        }


        arrayToSend[value] = sendValue;

    });
    debugLog(arrayToSend);

    if (counter === 0) {

        if (connectionStatus == "false") {
            notifyError("Can't connect to Anki. Please check it", "notifyAlert");


        } else {
            notifyError("All fields are empty", "notifyAlert");

        }



    } else {
        var params = {
            "note": {
                "deckName": currentDeck,
                "modelName": currentNoteType,
                "fields": arrayToSend,
                "tags": [currentTags]
            }
        };
        background.ankiConnectRequest("addNote", 6, params)
            .then(function (fulfilled) {

                clearTextBoxes();
                // debugLog(fulfilled);

                notifyError("Note is added succesfully.", "notifyalert");


            })
            .catch(function (error) {

                {
                    //notification for error
                    var currentError = JSON.stringify(error);
                    if (background.findRegex("Note is duplicate", currentError)) {
                        notifyError("This is a duplicate Note. Please change main field and try again", "notifyalert");

                    } else if (background.findRegex("Collection was not found", currentError)) {
                        notifyError("Collection was not found", "notifyalert");

                    } else if (background.findRegex("Note was empty", currentError)) {
                        notifyError("Note or front field was empty", "notifyalert");

                    } else if (background.findRegex("Model was not found", currentError)) {
                        errorLogs.innerHTML = "<span style=\"color:red\";>Model not found</span>:" + currentNoteType + "<input type=\"button\" id=\"deleteModelFromCache\" class=\"" + currentNoteType + "\" value=\"Delete Model\">\n";

                    } else if (background.findRegex("Deck was not found", currentError)) {
                        errorLogs.innerHTML = "<span style=\"color:red\";>Deck not found</span>:" + currentDeck + "<input type=\"button\" id=\"deleteDeckFromCache\" value=\"Delete Deck\">\n";

                    } else {
                        background.notifyUser("Error: " + error, "notifyalert");
                        errorLogs.innerHTML = "<span style=\"color:red\";>No, connection. Please, run Anki to Add card</span>";
                    }
                }
            });
    }

}

function clearTextBoxes() {
    //Notify background js to clear savedFormFields array
    port.postMessage("resetForms");

    $('textarea').each(function () {

        // reset value for all the fields
        $(this).val('');
        //clear global variable array

    });


    //clear Medium editor's divs
    jQuery('#addCard div').html('');

    $('#tags').val('');

}

//if context menu crashes
function reloadExtension() {
    port.postMessage("reloadContextMenu");
    notifySetting("<p>Successfully reloaded the context menu</p>");

}


function appendFields() {

    //change append mode for context menu
    var currentAppendMode;
    if (appendModeSettings == "0" || typeof appendModeSettings == "undefined") {
        saveChanges("appendModeSettings", "1");
        appendModeSettings = 1;
        currentAppendMode = "switched on for context menu";

    } else {

        saveChanges("appendModeSettings", "0");

        appendModeSettings = 0;
        currentAppendMode = "switched off";

    }
    notifySetting("<p>Append Mode: " + currentAppendMode + "</p>");

}

function changeDebugMode() {
    //change append mode for context menu
    var currentDebugMode;
    if (debugStatus == "0" || typeof debugStatus == "undefined") {
        saveChanges("debugStatus", "1");
        debugStatus = 1;
        currentDebugMode = "switched on to" + debugStatus;

    } else {

        saveChanges("debugStatus", "0");

        debugStatus = 0;
        currentDebugMode = "switched off";

    }
    notifySetting("<p>Debug Mode: " + currentDebugMode + "</p>");

}



function deleteExtension() {
    chrome.management.uninstallSelf({}, function (callback) {
        debugLog("alfa cleared.Please install again");
    });


}

$.fn.isAfter = function (sel) {
    return this.prevAll(sel).length !== 0;
};
$.fn.isBefore = function (sel) {
    return this.nextAll(sel).length !== 0;
};



function saveChanges(key, value) {
    // Check that there's some code there.
    if (!value) {

        debugLog('Error: No value specified for' + key);
        return;
    }


    // Save it using the Chrome extension storage API.
    chrome.storage.sync.set({
        [key]: value
    }, function () {
        //TODO: show to use for saved settings..
        debugLog('Settings saved for' + key + " and val below");
        debugLog(value);
    });
}



function clearNotes() {
    // CHANGE: array, not a string
    var toRemove = [];

    chrome.storage.sync.get(function (Items) {
        $.each(Items, function (index, value) {
            // build an array with all the keys to remove
            toRemove.push(index);
        });

        debugLog(toRemove + "settings removed");

        // inside callback
        chrome.storage.sync.remove(toRemove, function (Items) {

            restore_defaults();


        });
    });
    notifySetting("<p>Saved changes removed and restored to default!!</p><br>Please, open extension again");

}

debugLog = (function (undefined) {
    var debugLog = Error; // does this do anything?  proper inheritance...?
    debugLog.prototype.write = function (args) {

        /// * https://stackoverflow.com/a/3806596/1037948

        var suffix = {
            "@": (this.lineNumber ?
                    this.fileName + ':' + this.lineNumber + ":1" // add arbitrary column value for chrome linking
                    :
                    extractLineNumberFromStack(this.stack)
            )
        };

        args = args.concat([suffix]);
        // via @paulirish console wrapper
        if (console && console.log) {
            if (console.log.apply) {
                console.log.apply(console, args);
            } else {
                console.log(args);
            } // nicer display in some browsers
        }
    };
    var extractLineNumberFromStack = function (stack) {


        if (!stack) return '?'; // fix undefined issue reported by @sigod

        // correct line number according to how Log().write implemented
        var line = stack.split('\n')[2];
        // fix for various display text
        line = (line.indexOf(' (') >= 0 ?
                line.split(' (')[1].substring(0, line.length - 1) :
                line.split('at ')[1]
        );
        return line;
    };

    return function (params) {
        // only if explicitly true somewhere
        if (typeof debugStatus === typeof undefined || debugStatus === 0) return;

        // call handler extension which provides stack trace
        debugLog().write(Array.prototype.slice.call(arguments, 0)); // turn into proper array
    }; //--  fn  returned

})(); //--- _debugLog