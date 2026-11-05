entries = [
  "mod.json",
  "readme.txt",
  "ðŸŒ¿.png",
  "image_Ã©.png",
  "normal_image.png"
]

IO.inspect(
  ModderGuardStaticInspector.inspect_entries(entries, :geode),
  label: "Mojibake detection test",
  pretty: true
)