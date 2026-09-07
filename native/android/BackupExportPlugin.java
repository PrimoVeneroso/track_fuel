package com.fueltrack.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Saves through Android's document picker, without broad storage permissions. */
@CapacitorPlugin(name = "BackupExport")
public class BackupExportPlugin extends Plugin {
    private volatile boolean saving = false;

    @PluginMethod
    public void save(PluginCall call) {
        if (saving) {
            call.reject("Un salvataggio è già in corso.");
            return;
        }
        String filename = call.getString("filename");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType");
        if (filename == null || content == null || mimeType == null) {
            call.reject("Dati di esportazione mancanti.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        saving = true;
        try {
            startActivityForResult(call, intent, "documentSelected");
        } catch (Exception error) {
            saving = false;
            call.reject("Impossibile aprire il selettore di file.", error);
        }
    }

    @ActivityCallback
    private void documentSelected(PluginCall call, ActivityResult result) {
        if (call == null) {
            saving = false;
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK) {
            saving = false;
            JSObject response = new JSObject();
            response.put("status", "cancelled");
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            saving = false;
            call.reject("Nessun file selezionato.");
            return;
        }
        getBridge().execute(() -> {
            try {
                try (OutputStream stream = getContext().getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (stream == null) throw new java.io.IOException("File non scrivibile");
                    stream.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
                }
                JSObject response = new JSObject();
                response.put("status", "saved");
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Impossibile salvare il file.", error);
            } finally {
                saving = false;
            }
        });
    }
}
