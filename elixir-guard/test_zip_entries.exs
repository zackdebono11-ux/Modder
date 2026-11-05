file_path = "valid_test.zip"

{:ok, _} =
  :zip.create(
    String.to_charlist(file_path),
    [
      {~c"readme.txt", "Harmless Modder Guard test"},
      {~c"notes.txt", "Second harmless test entry"}
    ]
  )

{:ok, entries} = :zip.list_dir(String.to_charlist(file_path))

IO.inspect(entries, label: "ZIP entry metadata", pretty: true)

File.rm!(file_path)
