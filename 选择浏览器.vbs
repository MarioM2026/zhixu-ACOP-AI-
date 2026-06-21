' ZhiXu ACOP - Browser Selector
Dim url, choice, shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count > 0 Then
    url = WScript.Arguments(0)
Else
    url = "http://localhost:5173"
End If

choice = shell.Popup( _
    "ZhiXu ACOP Service Started!" & vbCrLf & vbCrLf & _
    "Choose browser to open Dashboard:" & vbCrLf & vbCrLf & _
    "  [Yes]    = Chrome Browser" & vbCrLf & _
    "  [No]     = Edge Browser" & vbCrLf & _
    "  [Cancel] = Default Browser" & vbCrLf & vbCrLf & _
    "URL: " & url, _
    0, _
    "ZhiXu ACOP - Select Browser", _
    3 + 64 _
)

Dim chromePaths, edgePaths, i

If choice = 6 Then
    chromePaths = Array( _
        shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe", _
        "C:\Program Files\Google\Chrome\Application\chrome.exe", _
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" _
    )
    For i = 0 To UBound(chromePaths)
        If fso.FileExists(chromePaths(i)) Then
            shell.Run """" & chromePaths(i) & """ """ & url & """", 1, False
            WScript.Quit 0
        End If
    Next
    shell.Run url, 1, False

ElseIf choice = 7 Then
    edgePaths = Array( _
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", _
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe", _
        shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\Edge\Application\msedge.exe" _
    )
    For i = 0 To UBound(edgePaths)
        If fso.FileExists(edgePaths(i)) Then
            shell.Run """" & edgePaths(i) & """ """ & url & """", 1, False
            WScript.Quit 0
        End If
    Next
    shell.Run url, 1, False

Else
    shell.Run url, 1, False
End If
